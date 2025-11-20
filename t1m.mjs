import * as exposes from "zigbee-herdsman-converters/lib/exposes";
import * as lumi from "zigbee-herdsman-converters/lib/lumi";
import * as m from "zigbee-herdsman-converters/lib/modernExtend";
import "zigbee-herdsman-converters/lib/types";

const {lumiModernExtend, manufacturerCode} = lumi;
const ea = exposes.access;

// T1M RGB Dynamic Effect definitions
const T1M_RGB_EFFECTS = {
    flow1: 0,
    flow2: 1,
    fading: 2,
    hopping: 3,
    breathing: 4,
    rolling: 5,
};

// Build RGB dynamic effect messages
// Format is identical for T1M and T2
function buildRGBEffectMessages(colorList, brightness8bit, effectId, speed) {
    // Encode all colors
    const colorBytes = [];
    for (const color of colorList) {
        const encoded = encodeColor(color);
        colorBytes.push(...encoded);
    }

    // Message 1: Colors (0x03)
    const msg1Length = 3 + colorList.length * 4;
    const msg1 = Buffer.from([0x01, 0x01, 0x03, msg1Length, brightness8bit, 0x00, colorList.length, ...colorBytes]);

    // Message 2: Effect Type (0x04)
    const msg2 = Buffer.from([0x01, 0x01, 0x04, 0x0c, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, effectId]);

    // Message 3: Speed (0x05)
    const msg3 = Buffer.from([0x01, 0x01, 0x05, 0x01, speed]);

    return {msg1, msg2, msg3};
}

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

function encodeColor(hexColor) {
    const normalized = hexColor.toUpperCase().replace("#", "");
    if (!/^[0-9A-F]{6}$/.test(normalized)) {
        throw new Error(`Invalid color format: ${hexColor}. Use format #RRGGBB (e.g., #FF0000)`);
    }

    const r = Number.parseInt(normalized.substr(0, 2), 16);
    const g = Number.parseInt(normalized.substr(2, 2), 16);
    const b = Number.parseInt(normalized.substr(4, 2), 16);

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

// Static ring segment control
function generateSegmentMask(segments) {
    const mask = [0, 0, 0, 0];

    for (const seg of segments) {
        if (seg < 1 || seg > 26) {
            throw new Error(`Invalid segment number: ${seg}. Must be 1-26`);
        }

        const bitPos = seg - 1;
        const byteIndex = Math.floor(bitPos / 8);
        const bitIndex = 7 - (bitPos % 8);

        mask[byteIndex] |= 1 << bitIndex;
    }

    return mask;
}

// Build packet for ring segment control
function buildRingPacket(segments, hexColor, brightness = 255) {
    const segmentMask = generateSegmentMask(segments);
    const colorBytes = encodeColor(hexColor);
    const brightnessByte = Math.max(0, Math.min(255, Math.round(brightness)));

    // Packet structure for static segment colors:
    // [0-3]:   Fixed header (01:01:01:0f)
    // [4]:     Brightness (0-255)
    // [5-8]:   Segment bitmask (4 bytes)
    // [9-12]:  Reserved (00:00:00:00)
    // [13-16]: Color (XY, 4 bytes)
    // [17-18]: Footer (02:bc)
    return [0x01, 0x01, 0x01, 0x0f, brightnessByte, ...segmentMask, 0x00, 0x00, 0x00, 0x00, ...colorBytes, 0x02, 0xbc];
}

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
        await endpoint.read("manuSpecificLumi", [0x0515], {manufacturerCode}); // dimming_range_minimum
        await endpoint.read("manuSpecificLumi", [0x0516], {manufacturerCode}); // dimming_range_maximum
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
        lumiModernExtend.lumiZigbeeOTA(),

        m.enumLookup({
            name: "power_on_behaviour",
            lookup: {on: 0, previous: 1, off: 2},
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0517, type: 0x20},
            description: "Controls the behavior when the device is powered on after power loss",
            zigbeeCommandOptions: {manufacturerCode},
        }),

        m.numeric({
            name: "off_on_duration",
            label: "Off to On dimming duration",
            cluster: "genLevelCtrl",
            attribute: {ID: 0x0012, type: 0x21},
            description: "The light will gradually brighten according to the set duration",
            entityCategory: "config",
            unit: "s",
            valueMin: 0,
            valueMax: 10.5,
            valueStep: 0.5,
            scale: 10,
        }),

        m.numeric({
            name: "on_off_duration",
            label: "On to Off dimming duration",
            cluster: "genLevelCtrl",
            attribute: {ID: 0x0013, type: 0x21},
            description: "The light will gradually dim according to the set duration",
            entityCategory: "config",
            unit: "s",
            valueMin: 0,
            valueMax: 10.5,
            valueStep: 0.5,
            scale: 10,
        }),

        m.numeric({
            name: "dimming_range_minimum",
            label: "Dimming Range Minimum",
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0515, type: 0x20},
            description: "Minimum Allowed Dimming Value",
            entityCategory: "config",
            zigbeeCommandOptions: {manufacturerCode},
            unit: "%",
            valueMin: 1,
            valueMax: 100,
            valueStep: 1,
        }),

        m.numeric({
            name: "dimming_range_maximum",
            label: "Dimming Range Maximum",
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0516, type: 0x20},
            description: "Maximum Allowed Dimming Value",
            entityCategory: "config",
            zigbeeCommandOptions: {manufacturerCode},
            unit: "%",
            valueMin: 1,
            valueMax: 100,
            valueStep: 1,
        }),
    ],

    meta: {},

    exposes: [
        // Static ring segment RGB control
        exposes
            .list(
                "ring_segments",
                ea.SET,
                exposes
                    .composite("segment_color", "segment_color", ea.SET)
                    .withFeature(exposes.numeric("segment", ea.SET).withValueMin(1).withValueMax(26).withDescription("Segment number (1-26)"))
                    .withFeature(exposes.text("color", ea.SET).withDescription("Hex color (e.g., #FF0000)")),
            )
            .withDescription("Set individual ring segment colors. Segments with the same color are automatically grouped."),

        // Static ring segment brightness control
        exposes
            .numeric("ring_segments_brightness", ea.SET)
            .withValueMin(0)
            .withValueMax(255)
            .withDescription("Brightness for ring segments (0-255, applies to all segments)")
            .withCategory("config"),

        // Dynamic ring RGB effects
        exposes
            .enum("rgb_effect", ea.SET, Object.keys(T1M_RGB_EFFECTS))
            .withDescription("RGB dynamic effect type for ring light")
            .withCategory("config"),
        exposes
            .text("rgb_effect_colors", ea.SET)
            .withDescription("Comma-separated RGB hex colors (e.g., #FF0000,#00FF00,#0000FF). 1-8 colors")
            .withCategory("config"),
        exposes
            .numeric("rgb_effect_brightness", ea.SET)
            .withValueMin(1)
            .withValueMax(100)
            .withValueStep(1)
            .withUnit("%")
            .withDescription("RGB dynamic effect brightness (1-100%)")
            .withCategory("config"),
        exposes
            .numeric("rgb_effect_speed", ea.SET)
            .withValueMin(1)
            .withValueMax(100)
            .withUnit("%")
            .withDescription("RGB dynamic effect speed (1-100%)")
            .withCategory("config"),
    ],

    toZigbee: [
        {
            key: ["ring_segments", "ring_segments_brightness"],
            convertSet: async (entity, key, value, meta) => {
                // Brightness
                if (key === "ring_segments_brightness") {
                    if (value < 0 || value > 255) {
                        throw new Error(`Invalid brightness: ${value}. Must be 0-255`);
                    }
                    return {state: {ring_segments_brightness: value}};
                }

                // Ring segments
                if (!Array.isArray(value) || value.length === 0) {
                    throw new Error("ring_segments must be a non-empty array");
                }

                // Brightness from state or use default
                const brightness = meta.state.ring_segments_brightness !== undefined ? meta.state.ring_segments_brightness : 255;

                // Group segments by colour
                const colorGroups = {};

                for (const item of value) {
                    if (!item.segment || !item.color) {
                        throw new Error('Each segment must have "segment" (1-26) and "color" (#RRGGBB) fields');
                    }

                    const segment = item.segment;
                    const color = item.color.toUpperCase();

                    if (segment < 1 || segment > 26) {
                        throw new Error(`Invalid segment: ${segment}. Must be 1-26`);
                    }

                    if (!colorGroups[color]) {
                        colorGroups[color] = {
                            color: color,
                            segments: [],
                        };
                    }
                    colorGroups[color].segments.push(segment);
                }

                // Send one packet per colour group
                const groups = Object.values(colorGroups);
                for (let i = 0; i < groups.length; i++) {
                    const group = groups[i];
                    const packet = buildRingPacket(group.segments, group.color, brightness);

                    const ATTR_RING_CONTROL = 0x0527;
                    await entity.write("manuSpecificLumi", {[ATTR_RING_CONTROL]: {value: packet, type: 0x41}}, {manufacturerCode});

                    if (i < groups.length - 1) {
                        await new Promise((resolve) => setTimeout(resolve, 50));
                    }
                }

                // Update state - ring light state turns on when segments are activated
                return {state: {ring_segments: value, state_rgb: "ON"}};
            },
        },
        {
            key: ["rgb_effect", "rgb_effect_colors", "rgb_effect_brightness", "rgb_effect_speed"],
            convertSet: async (entity, key, value, meta) => {
                // Read current state with defaults
                const effect = key === "rgb_effect" ? value : meta.state.rgb_effect || "flow1";
                const colors = key === "rgb_effect_colors" ? value : meta.state.rgb_effect_colors || "#FF0000,#00FF00,#0000FF";
                const brightnessPercent = key === "rgb_effect_brightness" ? value : meta.state.rgb_effect_brightness || 100;
                const speed = key === "rgb_effect_speed" ? value : meta.state.rgb_effect_speed || 50;

                const effectId = T1M_RGB_EFFECTS[effect];
                if (effectId === undefined) {
                    throw new Error(`Unknown effect: ${effect}. Supported: ${Object.keys(T1M_RGB_EFFECTS).join(", ")}`);
                }

                // Parse colours
                const colorList = colors.split(",").map((c) => c.trim());

                if (colorList.length < 1 || colorList.length > 8) {
                    throw new Error("Must provide 1-8 colors");
                }

                if (brightnessPercent < 1 || brightnessPercent > 100) {
                    throw new Error("Brightness must be between 1 and 100%");
                }

                if (speed < 1 || speed > 100) {
                    throw new Error("Speed must be between 1 and 100%");
                }

                // Convert brightness percentage to 8-bit value (0-254)
                const brightness8bit = Math.round((brightnessPercent / 100) * 254);

                const ATTR_RGB_EFFECT = 0x0527;

                // Build the three messages using shared function
                const {msg1, msg2, msg3} = buildRGBEffectMessages(colorList, brightness8bit, effectId, speed);

                // Send Message 1: Colours
                await new Promise((resolve) => setTimeout(resolve, 200));
                await entity.write(
                    "manuSpecificLumi",
                    {[ATTR_RGB_EFFECT]: {value: msg1, type: 0x41}},
                    {manufacturerCode, disableDefaultResponse: false},
                );

                // Send Message 2: Effect Type
                await entity.write(
                    "manuSpecificLumi",
                    {[ATTR_RGB_EFFECT]: {value: msg2, type: 0x41}},
                    {manufacturerCode, disableDefaultResponse: false},
                );

                // Send Message 3: Speed
                await new Promise((resolve) => setTimeout(resolve, 200));
                await entity.write(
                    "manuSpecificLumi",
                    {[ATTR_RGB_EFFECT]: {value: msg3, type: 0x41}},
                    {manufacturerCode, disableDefaultResponse: false},
                );

                 return {
                    state: {
                        rgb_effect: effect,
                        rgb_effect_colors: colors,
                        rgb_effect_brightness: brightnessPercent,
                        rgb_effect_speed: speed,
                        state_rgb: "ON",
                    },
                };
            },
        },
        {
            key: ["dimming_range_minimum", "dimming_range_maximum"],
            convertSet: async (entity, key, value, meta) => {
                // Validate that min doesn't exceed max
                const newMin = key === "dimming_range_minimum" ? value : meta.state.dimming_range_minimum;
                const newMax = key === "dimming_range_maximum" ? value : meta.state.dimming_range_maximum;

                if (newMin !== undefined && newMax !== undefined && newMin > newMax) {
                    throw new Error(`Minimum (${newMin}%) cannot exceed maximum (${newMax}%)`);
                }

                const attrId = key === "dimming_range_minimum" ? 0x0515 : 0x0516;
                await entity.write("manuSpecificLumi", {[attrId]: {value, type: 0x20}}, {manufacturerCode});

                return {state: {[key]: value}};
            },
        },
    ],
};

export default definition;
