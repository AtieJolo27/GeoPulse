# 🌱 GeoPulse: An IoT-Based Intelligent Platform for Comparative Analysis of Diverse Soil Geologies and Nutrient Densities

 **Capstone Project Presentation**

**Group Members**

- Jolo G. Atie
- Christoper C. Ditaunon
- Dave H. Limboc

---

# Slide 1 — Project Title

# 🌱 GeoPulse

### An IoT-Based Intelligent Platform for Comparative Analysis of Diverse Soil Geologies and Nutrient Densities

**Presented by:**

- Jolo G. Atie
- Christoper C. Ditaunon
- Dave H. Limboc

---

# Slide 2 — Introduction

Agriculture remains one of the most important sectors in food production. However, many farmers still rely on traditional methods when deciding which crops to plant and what fertilizers to apply.

Incorrect crop selection and improper fertilizer application can lead to:

Low crop yield
Soil nutrient depletion
Increased farming costs
Reduced productivity

GeoPulse addresses these challenges by utilizing IoT technology and Machine Learning to provide intelligent crop and fertilizer recommendations based on real-time soil conditions.

---

# Slide 3 — Purpose of the Project

The purpose of GeoPulse is to develop an intelligent IoT-based soil analysis platform capable of collecting soil sensor data and generating AI-powered crop and fertilizer recommendations.

The project aims to:

- Analyze real-time soil conditions
- Recommend the most suitable crop
- Recommend the appropriate fertilizer
- Store historical sensor readings
- Assist farmers in making data-driven agricultural decisions

---

# Slide 4 — Scope of the Project

## Included

- Development of IoT hardware for soil monitoring
- Collection of soil sensor data
- Backend API development using FastAPI
- Machine Learning integration
- React Native mobile application
- Supabase cloud database integration
- Crop recommendation
- Fertilizer recommendation
- Prediction history
- Real-time synchronization

---

## Excluded

- Automatic irrigation
- Pest detection
- Drone integration
- Satellite monitoring
- Commercial deployment
- Weather forecasting


---

# Slide 5 — Objectives

## General Objective

To develop an intelligent IoT platform capable of analyzing soil conditions and providing crop and fertilizer recommendations using Machine Learning.

---

## Specific Objectives

- Collect soil sensor readings
- Store collected data in a cloud database
- Predict the most suitable crop
- Recommend the best fertilizer
- Develop a mobile application
- Display historical prediction records

---

# Slide 6 — System Architecture
<img width="1408" height="768" alt="Gemini_Generated_Image_opid5ropid5ropid" src="https://github.com/user-attachments/assets/5f4c8671-0e44-4a2a-b801-0aaaca8ef436" />

---

# Slide 7 — Technologies Used

## Hardware

- ESP32
- 7 in 1 Soil Sensors

---

## Backend

- Python
- FastAPI
- Uvicorn
- Laravel

---

## Machine Learning

- Scikit-learn
- Random Forest Classifier
- Pandas
- NumPy

---

## Database

- Supabase
- PostgreSQL

---

## Frontend

- React Native
- Expo
- TypeScript
- NativeWind

---

# Slide 8 — Machine Learning

GeoPulse utilizes two Random Forest models.

## Model 1

### Crop Recommendation

Input Features

- Soil Moisture
- Soil Temperature
- Air Temperature
- Humidity
- Soil pH
- Nitrogen
- Phosphorus
- Potassium

Output

- Best Crop
- Alternative Crops
- Confidence Score


---

## Model 2

### Fertilizer Recommendation

Input Features

- Recommended Crop
- Nitrogen
- Phosphorus
- Potassium
- Temperature
- Humidity
- Soil pH

Output

- Best Fertilizer
- Alternative Fertilizers
- Confidence Score


---

# Slide 9 — Application Workflow
# Application Workflow

The GeoPulse system follows the workflow below:

```text
┌─────────────────────────┐
│      Soil Sensors       │
│  Collect Soil Readings  │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  ESP32 Microcontroller  │
│  Process Sensor Data    │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│    FastAPI Backend      │
│ Receive & Process Data  │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Crop Recommendation ML  │
│   Random Forest Model   │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Fertilizer Recommendation │
│   Random Forest Model      │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Supabase Database      │
│ Store Results & History  │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ React Native Mobile App │
│ Display Recommendations  │
└─────────────────────────┘


```
---

# Slide 10 — Mobile Application Features

## Dashboard

Displays

- Latest analysis
- Soil status
- Quick recommendations

---

## Crop Recommendation

Displays

- Best crop
- Confidence score
- Alternative crops

---

## Fertilizer Recommendation

Displays

- Best fertilizer
- Confidence score
- Alternative fertilizers

---

## History

Displays

- Previous analyses
- Crop recommendations
- Fertilizer recommendations
- Date and time

---
# Slide 11 — Progress

## Working Features

- Supabase Connection
- Working Machine Learning (Random Forest)
- Crop Recommendation based on Random Forest
- Fertilizer Recommendation based on Random Forest
- AI-Based Reasoning for Crop Recommendation
- AI-Based Reasoning for Fertilizer Recommendation
- Charts for Soil Health and Parameters History







## Crop success results

Apply `supabase/migrations/202610110001_crop_outcomes.sql` to the connected Supabase database before using the crop success graph. Access follows existing zone visibility. The graph groups farmer-reported completed growing cycles by crop for the active zone. Success means a usable harvest; record each cycle once. Success rate = successful cycles / all recorded completed cycles * 100. The PDF still exports sensor history.

Sensor stability instructions are in Tips and Guides. Exact warm-up time and repeatability tolerance must come from the installed sensor manufacturer; no model-specific timing is configured.

## Groq fertilizer advice

The fertilizer tab now reads the selected zone latest NPK readings directly from Supabase and calls the Expo-hosted `/api/groq` route with `mode: fertilizer`. It includes the currently planted crop, or provisional app nutrient reference ranges for an unplanted zone. Advice includes reviewed University of Minnesota Extension reference links. No Render recommendation endpoint or model confidence is used by this tab. New sensor readings show a refresh notice.

Export the web app and deploy with `npx.cmd eas-cli deploy --prod --environment production`. Configure server-only `GROQ_API_KEY` in the production EAS environment with Sensitive visibility.
