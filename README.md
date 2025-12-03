# Aqara-T1M-Ceiling-Light
Zigbee2MQTT external converter for Aqara T1M Ceiling Light with RGB ring light segment control and dynamic RGB effects.

In static mode the RGB ring light has 26 individual segments each of which can be set to unique colors or turned off. These can be defined and activated through a Home Assistant blueprint.

Dynamic RGB Effect patterns can be created and activated via Home Assistant having the following properties:

*Effect Type:*

**Flow 1 & Flow 2**: Colors smoothly transition from one to the next in a continuous loop. Flow 1 is clockwise, Flow 2 anti-clockwise

**Fading**:
Colors fade in and out, creating a gentle pulsing effect between colors.

**Hopping**:
Colors jump/switch instantly between colors with no transition.

**Breathing**:
Colors pulse like breathing - getting brighter then dimmer rhythmically.

**Rolling**:
Colors rotate around the ring in a spinning motion.

*Brightness:* 1% - 100%

*Speed:* 1% - 100%

*Colors:* Between 1 and 8 colors can be set for each effect. The color slots are defined by a comma seperated list of RGB hex values, e.g. #ff0000,#00ff00,#0000ff for red, green, blue. 

## Installation

*Requires Zigbee2MQTT 2.7.0 or above*

In Zigbee2MQTT go to **settings** → **dev console** → **external converters**, create a new converter named **t1m.mjs** and paste in the contents of the file. Click save then restart Zigbee2MQTT via **settings** → **tools**

Alternatively place the file **t1m.mjs** in the folder **zigbee2mqtt/data/external_converters** and restart Zigbee2MQTT.

If an external converter is active for a device a cyan icon with "Supported: external" will be displayed under the device name in Zigbee2MQTT.

## Home Assistant
The Home Assistant folder contains a collection of blueprint, scripts, cards and examples to control the RGB ring light with color segmentations and dynamic effects.

## RGB Ring Segment Patterns
### aqara_t1m_ring_segments_blueprint.yaml
Home Assistant script blueprint to control the RGB ring light segments.

#### 1. Import the Blueprint
1. In Home Assistant, go to **Settings** → **Automations & Scenes** → **Blueprints**
2. Click the **Import Blueprint** button
3. Paste the URL to this blueprint file or upload it directly
4. Click **Preview** and then **Import**

#### 2. Create a Script from the Blueprint
1. Go to **Settings** → **Automations & Scenes** → **Scripts**
2. Click **Add Script** → **Create new script from blueprint**
3. Select **Aqara T1M - RGB Ring Segments Script**
4. Configure the script:
   - **Name**: Give it a descriptive name (e.g., "T1M Custom Ring Pattern")
   - **Device Name**: Enter your T1M light's friendly name from Zigbee2MQTT (e.g., "Living Room Light")
     - This is the name shown in the Zigbee2MQTT web interface, NOT the Home Assistant entity name
     - You can find this in Zigbee2MQTT → Devices → your light
   - **Global Brightness**: 1% - 100%
   - **Color Pickers**: Configure each of the 26 segment colors. #000000 (black) turns off a segment.
5. Save the script

#### 3. Running a created script
Once created, you can run a script in several ways:

1. **Manually**: Go to **Settings** → **Automations & Scenes** → **Scripts** and run it
2. **Dashboard Button**: Add a script button to your dashboard
3. **Automation**: Trigger it from an automation

### aqara_t1m_ring_segments_script_examples.yaml

These call the blueprint with 12 examples based on the presets in the Aqara Home app. Requires the above blueprint aqara_t1m_ring_segments_blueprint.yaml

1. Replace YOUR_LIGHT_NAME with your light's friendly name from Zigbee2MQTT
2. Add the scripts code to your scripts.yaml
      
### aqara_t1m_ring_segments_card.yaml

Simple dashboard buttons card example for activating RGB ring segment scripts. Requires aqara_t1m_ring_segments_script_examples.yaml and aqara_t1m_ring_segments_blueprint.yaml

1. Edit your Home Assistant dashboard
2. Click **Add Card** → **Manual**
3. Copy and paste in the YAML code
4. For brightness slider create an Input Helper via Home Assistant UI
    1. Settings → Devices & Services → Helpers
    2. Create Number helper:
       - Name: `t1m_preset_brightness`
       - Min: 1
       - Max: 100
       - Step: 1

### aqara_t1m_ring_segments_card_custom_icons.yaml

Dashboard buttons card example with custom icons for activating RGB ring segment scripts.  Requires aqara_t1m_ring_segments_script_examples.yaml and aqara_t1m_ring_segments_blueprint.yaml

**Uses hass-custom_icons** - https://github.com/thomasloven/hass-custom_icons

1. Place icons in folder custom_icons/t1m_icons 
2. Edit your Home Assistant dashboard
3. Click **Add Card** → **Manual**
4. Copy and paste in the YAML code
5. For brightness slider create an Input Helper via Home Assistant UI
    1. Settings → Devices & Services → Helpers
    2. Create Number helper:
       - Name: `t1m_preset_brightness`
       - Min: 1
       - Max: 100
       - Step: 1

## RGB Ring Dynamic Effect Patterns

### aqara_t1m_rgb_effects_blueprint.yaml
Home Assistant script blueprint for custom RGB ring light dynamic effects.

#### 1. Import the Blueprint
1. In Home Assistant, go to **Settings** → **Automations & Scenes** → **Blueprints**
2. Click the **Import Blueprint** button
3. Paste the URL to this blueprint file or upload it directly to blueprints/script/aqara/aqara_t1m_rgb_effects_blueprint.yaml
4. Click **Preview** and then **Import**

#### 2. Create a Script from the Blueprint
1. Go to **Settings** → **Automations & Scenes** → **Scripts**
2. Click **Add Script** → **Create new script from blueprint**
3. Select **Aqara T1M - RGB Ring Effect Script**
4. Configure the script:
   - **Name**: Give it a descriptive name (e.g., "T1M Custom Ring Pattern")
   - **Target Lights**: Select one or more T1M target RGB enitities/devices, (e.g., light.ceiling_light_rgb)
   - **Zigbee2MQTT Base Topic**: Only needs to be changed if you have a non-standard Zigbee2MQTT installation
   - **RGB Effect**: Select the dynamic effect to use
   - **Number of colors**: Set the number of color pickers the effect pattern will use
   - **Color Pickers**: Configure the number of color pickers selected in the step above.
   - **Effect Brightnes**: Percentage between 1 and 100
   - **Effect Speed**: Percentage between 1 and 100
5. Save the script

#### 3. Running a created script
Once created, you can run a script in several ways:

1. **Manually**: Go to **Settings** → **Automations & Scenes** → **Scripts** and run it
2. **Dashboard Button**: Add a script button to your dashboard
3. **Automation**: Trigger it from an automation

### aqara_t1m_rgb_effects_script_examples.yaml

These call the blueprint with 9 examples based on the presets in the Aqara Home app: Dinner, Sunset, Autumn, Galaxy, Daydream, Holiday, Party, Meteor, Alert.

1. Replace light.your_t1m_light with your light's actual RGB entity ID
2. Add the scripts code to your scripts.yaml

### aqara_t1m_rgb_effects_card.yaml

Simple dashboard buttons card example for activating RGB dynamic effects scripts. Requires aqara_t1m_rgb_effects_script_examples.yaml and aqara_t1m_rgb_effects_blueprint.yaml

1. Edit your Home Assistant dashboard
2. Click **Add Card** >> **Manual**
3. Copy and paste in the YAML code
4. For the "Stop" button, replace light.your_t1m_light with your light's actual RGB entity ID

### Stopping Effects
Click the **Stop Effects** button to turn off the dynamic effect, or

Click any static preset button, or

Adjust ring light settings manually or with automation, or

Turn the light off/on

### Finding Your Light Entity ID
**Settings** → **Entities**  
Find your T1M light 
Note the RGB entity ID (e.g., light.ceiling_light_rgb)

## Notes
  
- This converter mimics the dynamic RGB effect creation and preview feature of the Aqara Home app.
  
- The dynamic RGB effects are not written as scenes to the light's memory as they are when using the Aqara app. That process is done via OTA firmware writes which are not implemented here.
  
- Activating such saved effect scenes as well as the light's built in scenes appears to have some sort of vendor lock. Possibly the light is checking if the Zigbee commands are coming from an Aqara hub and won't activate them if the source IEEE address doesn't match.
  
- As such, every time you want to activate a particular effect pattern/scene you have to send all the parameters for that effect to the light again (colour selections, brightness, speed and effect type). This is currently achieved through Home Assistant MTQQ payloads containing your custom effect parameters. Example blueprints and card templates are provided to do this.

- White Dynamic Effects are similarly done via OTA firmware writes, however the preview feature is also done this way with these effects.

- Further investigation needs to be done on the White Dynamic Effects and also the OTA firmware writing process to see how these can be replicated.
