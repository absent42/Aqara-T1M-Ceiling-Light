import * as exposes from "zigbee-herdsman-converters/lib/exposes";
import * as lumi from "zigbee-herdsman-converters/lib/lumi";
import * as m from "zigbee-herdsman-converters/lib/modernExtend";
import "zigbee-herdsman-converters/lib/types";

const {lumiModernExtend, manufacturerCode} = lumi;
const ea = exposes.access;

// ============================================================================
// SHARED COLOR CONVERSION FUNCTIONS (identical across T1M, T1 Strip, T2)
// ============================================================================

// Convert RGB to XY
function rgbToXY(r, g, b) {
    // Normalize RGB to 0-1
    let red = r / 255.0;
    let green = g / 255.0;
    let blue = b / 255.0;

    // Apply gamma correction (sRGB)
    red = red > 0.04045 ? ((red + 0.055) / 1.055) ** 2.4 : red / 12.92;
    green = green > 0.04045 ? ((green + 0.055) / 1.055) ** 2.4 : green / 12.92;
    blue = blue > 0.04045 ? ((blue + 0.055) / 1.055) ** 2.4 : blue / 12.92;

    // Convert to XYZ using sRGB D65 conversion matrix
    const X = red * 0.4124564 + green * 0.3575761 + blue * 0.1804375;
    const Y = red * 0.2126729 + green * 0.7151522 + blue * 0.072175;
    const Z = red * 0.0193339 + green * 0.119192 + blue * 0.9503041;

    const sum = X + Y + Z;
    if (sum === 0) {
        return {x: 0, y: 0};
    }

    return {
        x: X / sum,
        y: Y / sum,
    };
}

function encodeColor(color) {
    // Validate RGB object
    if (typeof color !== 'object' || color.r === undefined || color.g === undefined || color.b === undefined) {
        throw new Error(`Invalid color format. Expected {r: 0-255, g: 0-255, b: 0-255}, got: ${JSON.stringify(color)}`);
    }

    const r = Number(color.r);
    const g = Number(color.g);
    const b = Number(color.b);

    // Validate ranges
    if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
        throw new Error(`RGB values must be between 0-255. Got r:${r}, g:${g}, b:${b}`);
    }

    // Convert RGB to XY
    const xy = rgbToXY(r, g, b);

    // Scale to 16-bit integers
    const xScaled = Math.round(xy.x * 65535);
    const yScaled = Math.round(xy.y * 65535);

    // Pack into 4 bytes (big endian): [x_high, x_low, y_high, y_low]
    return [
        (xScaled >>> 8) & 0xff, // x_high
        xScaled & 0xff, // x_low
        (yScaled >>> 8) & 0xff, // y_high
        yScaled & 0xff, // y_low
    ];
}

// ============================================================================
// UNIFIED SEGMENT CONTROL HELPERS (works for both T1M and T1 Strip)
// ============================================================================

/**
 * Detect device type from model ID
 * @param {object} meta - Zigbee2MQTT meta object
 * @returns {string} "t1m" or "strip"
 */
function getDeviceType(meta) {
    const model = meta.device.modelID;
    // T1M: lumi.light.acn032, lumi.light.acn031
    // T1 Strip: lumi.light.acn132
    return model === "lumi.light.acn132" ? "strip" : "t1m";
}

/**
 * Generate segment bitmask for specified segments
 * @param {number[]} segments - Array of segment numbers (1-based)
 * @param {string} deviceType - "t1m" or "strip"
 * @param {number} maxSegments - Maximum valid segment number
 * @returns {number[]} Bitmask array (4 bytes for T1M, 8 bytes for strip)
 */
function generateSegmentMask(segments, deviceType, maxSegments) {
    const maskSize = deviceType === "t1m" ? 4 : 8;
    const mask = new Array(maskSize).fill(0);

    for (const seg of segments) {
        if (seg < 1 || seg > maxSegments) {
            throw new Error(`Invalid segment: ${seg}. Must be 1-${maxSegments}`);
        }

        const bitPos = seg - 1;
        const byteIndex = Math.floor(bitPos / 8);
        const bitIndex = 7 - (bitPos % 8);

        mask[byteIndex] |= 1 << bitIndex;
    }

    return mask;
}

/**
 * Build segment control packet
 * @param {number[]} segments - Array of segment numbers (1-based)
 * @param {object} color - RGB color object {r, g, b}
 * @param {number} brightness - Brightness value (0-255)
 * @param {string} deviceType - "t1m" or "strip"
 * @param {number} maxSegments - Maximum valid segment number
 * @returns {number[]} Packet bytes
 */
function buildSegmentPacket(segments, color, brightness, deviceType, maxSegments) {
    const segmentMask = generateSegmentMask(segments, deviceType, maxSegments);
    const colorBytes = encodeColor(color);
    const brightnessByte = Math.max(0, Math.min(255, Math.round(brightness)));

    if (deviceType === "t1m") {
        // T1M packet structure:
        // [0-3]:   Fixed header (01:01:01:0f)
        // [4]:     Brightness (0-255)
        // [5-8]:   Segment bitmask (4 bytes)
        // [9-12]:  Reserved (00:00:00:00)
        // [13-16]: Color (XY, 4 bytes)
        // [17-18]: Footer (02:bc)
        return [0x01, 0x01, 0x01, 0x0f, brightnessByte, ...segmentMask, 0x00, 0x00, 0x00, 0x00, ...colorBytes, 0x02, 0xbc];
    }
    // T1 Strip packet structure:
    // [0-3]:   Fixed header (01:01:01:0f)
    // [4]:     Brightness (0-255)
    // [5-12]:  Segment bitmask (8 bytes)
    // [13-16]: Color (XY, 4 bytes)
    // [17-18]: Footer (00:14)
    return [0x01, 0x01, 0x01, 0x0f, brightnessByte, ...segmentMask, ...colorBytes, 0x00, 0x14];
}

// ============================================================================
// END UNIFIED SEGMENT CONTROL HELPERS
// ============================================================================

const definition = {
    zigbeeModel: ["lumi.light.acn032", "lumi.light.acn031"],
    model: "CL-L02D",
    vendor: "Aqara",
    description: "Ceiling light T1M",
    whiteLabel: [
        {
            model: "HCXDD12LM",
            vendor: "Aqara",
            description: "Ceiling light T1",
            fingerprint: [{modelID: "lumi.light.acn031"}],
        },
    ],

    configure: async (device, coordinatorEndpoint) => {
        const endpoint = device.getEndpoint(1);
        await endpoint.read("manuSpecificLumi", [0x0515], {manufacturerCode: manufacturerCode}); // dimming_range_minimum
        await endpoint.read("manuSpecificLumi", [0x0516], {manufacturerCode: manufacturerCode}); // dimming_range_maximum
        await endpoint.read("genLevelCtrl", [0x0012], {}); // off_on_duration
        await endpoint.read("genLevelCtrl", [0x0013], {}); // on_off_duration
    },

    extend: [
        m.deviceEndpoints({endpoints: {white: 1, rgb: 2}}),
        lumiModernExtend.lumiLight({colorTemp: true, endpointNames: ["white"]}),
        lumiModernExtend.lumiLight({
            colorTemp: true,
            deviceTemperature: false,
            powerOutageCount: false,
            color: {modes: ["xy"]},
            endpointNames: ["rgb"],
        }),
        m.forcePowerSource({powerSource: "Mains (single phase)"}),
        lumiModernExtend.lumiPowerOnBehavior({lookup: {on: 0, previous: 1, off: 2}}),
        lumiModernExtend.lumiZigbeeOTA(),

        lumiModernExtend.lumiDimmingRangeMin(),
        lumiModernExtend.lumiDimmingRangeMax(),
        lumiModernExtend.lumiOnOffDuration(),
        lumiModernExtend.lumiOffOnDuration(),

        // RGB Effect Type - T1M specific mappings
        m.enumLookup({
            name: "rgb_effect",
            lookup: {flow1: 0, flow2: 1, fading: 2, hopping: 3, breathing: 4, rolling: 5},
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x051f, type: 0x23},
            description: "RGB dynamic effect type for ring light",
            zigbeeCommandOptions: {manufacturerCode},
        }),

        // RGB Effect Speed
        m.numeric({
            name: "rgb_effect_speed",
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0520, type: 0x20},
            description: "RGB dynamic effect speed (1-100%)",
            zigbeeCommandOptions: {manufacturerCode},
            unit: "%",
            valueMin: 1,
            valueMax: 100,
            valueStep: 1,
        }),
    ],

    meta: {},

    exposes: [
        // Segment color control
        exposes
            .list(
                "segment_colors",
                ea.SET,
                exposes
                    .composite("segment_color", "segment_color", ea.SET)
                    .withFeature(exposes.numeric("segment", ea.SET).withValueMin(1).withValueMax(26).withDescription("Segment number (1-26)"))
                    .withFeature(
                        exposes
                            .composite("color", "color", ea.SET)
                            .withFeature(exposes.numeric("r", ea.SET).withValueMin(0).withValueMax(255).withDescription("Red (0-255)"))
                            .withFeature(exposes.numeric("g", ea.SET).withValueMin(0).withValueMax(255).withDescription("Green (0-255)"))
                            .withFeature(exposes.numeric("b", ea.SET).withValueMin(0).withValueMax(255).withDescription("Blue (0-255)"))
                            .withDescription("RGB color object"),
                    ),
            )
            .withDescription("Set individual ring segment colors. Black (0,0,0) turns off the segment.")
            .withCategory("config"),

        // Segment brightness control
        exposes
            .numeric("segment_brightness", ea.SET)
            .withValueMin(1)
            .withValueMax(100)
            .withUnit("%")
            .withDescription("Brightness for segment colors (1-100%)")
            .withCategory("config"),

        // RGB dynamic effects
        exposes
            .list("rgb_effect_colors", ea.SET, exposes.composite("color", "color", ea.SET)
                .withFeature(exposes.numeric("r", ea.SET).withValueMin(0).withValueMax(255).withDescription("Red (0-255)"))
                .withFeature(exposes.numeric("g", ea.SET).withValueMin(0).withValueMax(255).withDescription("Green (0-255)"))
                .withFeature(exposes.numeric("b", ea.SET).withValueMin(0).withValueMax(255).withDescription("Blue (0-255)")))
            .withDescription("Array of RGB color objects for dynamic effects (1-8 colors)")
            .withLengthMin(1)
            .withLengthMax(8)
            .withCategory("config"),

        exposes
            .numeric("rgb_effect_brightness", ea.SET)
            .withValueMin(1)
            .withValueMax(100)
            .withValueStep(1)
            .withUnit("%")
            .withDescription("RGB dynamic effect brightness (1-100%)")
            .withCategory("config"),
    ],

    toZigbee: [
        {
            key: ["segment_colors", "segment_brightness"],
            convertSet: async (entity, key, value, meta) => {
                // Handle brightness setting
                if (key === "segment_brightness") {
                    if (value < 1 || value > 100) {
                        throw new Error(`Invalid brightness: ${value}. Must be 1-100%`);
                    }
                    return {state: {segment_brightness: value}};
                }

                // Segment colors
                if (!Array.isArray(value) || value.length === 0) {
                    throw new Error("segment_colors must be a non-empty array");
                }

                // Detect device type and determine max segments
                const deviceType = getDeviceType(meta);
                const maxSegments = deviceType === "t1m" ? 26 : Math.round((meta.state.length || 2) * 5);

                // Brightness from state or use default (100%)
                const brightnessPercent = meta.state.segment_brightness !== undefined ? meta.state.segment_brightness : 100;

                // Convert percentage (1-100) to hardware value (0-255)
                const brightness = Math.round((brightnessPercent / 100) * 255);

                // Group segments by color
                const colorGroups = {};
                const specifiedSegments = new Set();

                for (const item of value) {
                    if (!item.segment || !item.color) {
                        throw new Error(`Each segment must have "segment" (1-${maxSegments}) and "color" {r, g, b} fields`);
                    }

                    const segment = item.segment;
                    const color = item.color;

                    if (segment < 1 || segment > maxSegments) {
                        throw new Error(`Invalid segment: ${segment}. Must be 1-${maxSegments}`);
                    }

                    // Validate color object
                    if (typeof color !== 'object' || color.r === undefined || color.g === undefined || color.b === undefined) {
                        throw new Error(`Invalid color for segment ${segment}. Expected {r, g, b}`);
                    }

                    // Use color object as key (JSON string for grouping)
                    const colorKey = JSON.stringify({r: color.r, g: color.g, b: color.b});

                    if (!colorGroups[colorKey]) {
                        colorGroups[colorKey] = {
                            color: color,
                            segments: [],
                        };
                    }
                    colorGroups[colorKey].segments.push(segment);
                    specifiedSegments.add(segment);
                }

                // Turn off unspecified segments by setting to black
                const unspecifiedSegments = [];
                for (let seg = 1; seg <= maxSegments; seg++) {
                    if (!specifiedSegments.has(seg)) {
                        unspecifiedSegments.push(seg);
                    }
                }

                if (unspecifiedSegments.length > 0) {
                    const blackColorKey = JSON.stringify({r: 0, g: 0, b: 0});
                    if (!colorGroups[blackColorKey]) {
                        colorGroups[blackColorKey] = {
                            color: {r: 0, g: 0, b: 0},
                            segments: unspecifiedSegments,
                        };
                    } else {
                        colorGroups[blackColorKey].segments.push(...unspecifiedSegments);
                    }
                }

                // Send one packet per color group
                const groups = Object.values(colorGroups);
                const ATTR_SEGMENT_CONTROL = 0x0527;

                for (let i = 0; i < groups.length; i++) {
                    const group = groups[i];
                    const packet = buildSegmentPacket(group.segments, group.color, brightness, deviceType, maxSegments);

                    await entity.write(
                        "manuSpecificLumi",
                        {[ATTR_SEGMENT_CONTROL]: {value: Buffer.from(packet), type: 0x41}},
                        {manufacturerCode, disableDefaultResponse: false},
                    );

                    if (i < groups.length - 1) {
                        await new Promise((resolve) => setTimeout(resolve, 50));
                    }
                }

                // Determine correct state key based on device type
                const stateKey = deviceType === "t1m" ? "state_rgb" : "state";

                return {state: {segment_colors: value, segment_brightness: brightnessPercent, [stateKey]: "ON"}};
            },
        },
        {
            key: ["rgb_effect_colors", "rgb_effect_brightness"],
            convertSet: async (entity, key, value, meta) => {
                // Read from incoming message first (allows single MQTT payload with all params),
                // then fall back to state, then to defaults
                const colors = meta.message.rgb_effect_colors || meta.state.rgb_effect_colors || [{r: 255, g: 0, b: 0}, {r: 0, g: 255, b: 0}, {r: 0, g: 0, b: 255}];
                const brightnessPercent = meta.message.rgb_effect_brightness ?? meta.state.rgb_effect_brightness ?? 100;

                // Colors should now be an array of RGB objects
                const colorList = colors;

                if (!Array.isArray(colorList) || colorList.length < 1 || colorList.length > 8) {
                    throw new Error("Must provide array of 1-8 RGB color objects");
                }

                if (brightnessPercent < 1 || brightnessPercent > 100) {
                    throw new Error("Brightness must be between 1 and 100%");
                }

                // Convert brightness percentage to 8-bit value (0-255)
                const brightness8bit = Math.round((brightnessPercent / 100) * 255);

                // Encode all colors for the color message
                const colorBytes = [];
                for (const color of colorList) {
                    const encoded = encodeColor(color);
                    colorBytes.push(...encoded);
                }

                // Build color message (0x03 prefix) - sent to 0x0527
                const msg1Length = 3 + colorList.length * 4;
                const msg1 = Buffer.from([0x01, 0x01, 0x03, msg1Length, brightness8bit, 0x00, colorList.length, ...colorBytes]);

                const ATTR_RGB_COLORS = 0x0527;

                // Send colors to 0x0527
                await entity.write(
                    "manuSpecificLumi",
                    {[ATTR_RGB_COLORS]: {value: msg1, type: 0x41}},
                    {manufacturerCode, disableDefaultResponse: false},
                );

                // Determine correct state key based on device type
                const deviceType = getDeviceType(meta);
                const stateKey = deviceType === "t1m" ? "state_rgb" : "state";

                return {
                    state: {
                        rgb_effect_colors: colors,
                        rgb_effect_brightness: brightnessPercent,
                        [stateKey]: "ON",
                    },
                };
            },
        },
    ],
};

export default definition;
