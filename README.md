# Aqara-T1M-Ceiling-Light
Zigbee2MQTT external converter for Aqara T1M Ceiling Light with RGB ring light segment control and dynamic RGB effects.

## Installation
In Zigbee2MQTT go to settings>>dev console>>external converters, create a new converter named **t1m.mjs** and paste in the contents of the file. Click save then restart Zigbee2MQTT via settings>>tools

Alternatively place the file **t1m.mjs** in the folder zigbee2mqtt/data/external_converters and restart Zigbee2MQTT.

If an external converter is active for a device a cyan icon with "Supported: external" will be displayed under the device name in Zigbee2MQTT.

## Home Assistant
## aqara_t1m_ring_segments.yaml
Blueprint to control the RGB ring light segments.

### 1. Import the Blueprint
1. In Home Assistant, go to **Settings** → **Automations & Scenes** → **Blueprints**
2. Click the **Import Blueprint** button
3. Paste the URL to this blueprint file or upload it directly
4. Click **Preview** and then **Import**

### 2. Create a Script from the Blueprint
1. Go to **Settings** → **Automations & Scenes** → **Scripts**
2. Click **Add Script** → **Create new script from blueprint**
3. Select **"Aqara T1M Ceiling Light - RGB Ring Segment Colors"**
4. Configure the script:
   - **Name**: Give it a descriptive name (e.g., "T1M Custom Ring Pattern")
   - **Device Name**: Enter your T1M light's friendly name from Zigbee2MQTT (e.g., "Living Room Light")
     - This is the name shown in the Zigbee2MQTT web interface, NOT the Home Assistant entity name
     - You can find this in Zigbee2MQTT → Devices → your light
   - **Global Brightness**: Set the brightness level (default: 255 = full brightness)
   - **Color Pickers**: Configure each of the 26 segment colors

### 3. Running the Script
Once created, you can run the script in several ways:

1. **Manually**: Go to **Settings** → **Automations & Scenes** → **Scripts** and run it
2. **Dashboard Button**: Add a script button to your dashboard
3. **Automation**: Trigger it from an automation

## aqara_t1m_rgb_effects.yaml 
HA buttons card for activing RGB dynamic effects and creating custom effects. Uses the Aqara app preset effects as examples.

### 1. Usage
1. Edit your Home Assistant dashboard
2. Click **Add Card** → **Manual**
3. Copy and paste the YAML into the editor
4. **IMPORTANT**: Replace `YOUR_LIGHT_NAME` with your actual device friendly name from Zigbee2MQTT, NOT the Home Assistant device name
5. Save the card

### 2. Creating Custom Effects

Copy an existing button and modify these parameters:
```
name: My Custom Effect
icon: mdi:creation
topic: zigbee2mqtt/YOUR_LIGHT_NAME/set
payload: '{"rgb_effect":"breathing","rgb_effect_colors":"#ffaa00,#00aaff","rgb_effect_brightness":100,"rgb_effect_speed":30}'
```

**rgb_effect**
```
One of the following:

flow1
flow2
fading
hopping
breathing
rolling
off
```

**rgb_effect_colors**
```
Comma seperated list of RGB hex values, between 1 and 8 different colors, for example

#ff0000,#00ff00,#0000ff

for red,green,blue
```

**rgb_effect_brightness**
```
number between 1 and 100, representing brightness %
```

**rgb_effect_speed**
```
number between 1 and 100, representing speed %
```

## Notes
  
- This converter mimics the dynamic RGB effect creation and preview feature of the Aqara Home app.
  
- The dynamic RGB effects are not written as scenes to the light's memory as they are when using the Aqara app. That process is done via OTA firmware writes which are not implemented here.
  
- Activating such saved effect scenes as well as the light's built in scenes appears to have some sort of vendor lock. Possibly the light is checking if the Zigbee commands are coming from an Aqara hub and won't activate them if the source IEEE address doesn't match.
  
- As such, every time you want to activate a particular effect you will have to send the parameters for that effect to the light again (colour selections, brightness, speed and effect type). 

- White Dynamic Effects are similarly done via OTA firmware writes, however the preview feature is also done this way with these effects.

- Further investigation needs to be done on the White Dynamic Effects and also the OTA firmware writing process to see how these can be replicated.
