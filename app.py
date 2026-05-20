import streamlit as st
import pandas as pd
import numpy as np
import joblib
import os
from catboost import CatBoostRegressor
import xgboost as xgb
import lightgbm as lgb
from datetime import datetime, time

# ==========================================
# 1. PAGE CONFIGURATION
# ==========================================
st.set_page_config(
    page_title="UrbanFlow: NYC Mobility Predictor",
    page_icon="U",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS - FIXED FOR DARK MODE
# We use !important to force the text to be black, regardless of your theme.
st.markdown("""
    <style>
    .main {
        background-color: #f0f2f6;
    }
    .stButton>button {
        width: 100%;
        background-color: #ff4b4b;
        color: white;
        font-weight: bold;
        border-radius: 8px;
        height: 50px;
    }
    /* Card Styles */
    .metric-card {
        background-color: #ffffff; /* Always White Background */
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        text-align: center;
        border-left: 5px solid #ff4b4b;
        margin-bottom: 10px;
    }
    /* Force Text Colors to Black for visibility */
    .metric-label {
        font-size: 1rem;
        color: #333333 !important; 
        margin-bottom: 5px;
        font-weight: 600;
    }
    .metric-value {
        font-size: 2.2rem;
        font-weight: 800;
        color: #000000 !important;
        margin: 0;
    }
    .metric-unit {
        font-size: 1rem;
        color: #666666 !important;
        font-weight: normal;
    }
    </style>
""", unsafe_allow_html=True)

# ==========================================
# 2. LOAD RESOURCES
# ==========================================
@st.cache_resource
def load_resources():
    try:
        lgbm_model = joblib.load('models/urbanflow_lgbm_model.pkl')
        xgb_model = joblib.load('models/urbanflow_xgboost_final.pkl')
        cb_model = CatBoostRegressor()
        cb_model.load_model('models/urbanflow_catboost.cbm')
        zones = pd.read_csv('taxi_zone_lookup.csv')
        return lgbm_model, xgb_model, cb_model, zones
    except Exception as e:
        return None, None, None, None

lgbm, xgboost, catboost, zone_df = load_resources()

if lgbm is None:
    st.error("Critical Error: Could not load models. Check 'models/' folder.")
    st.stop()

# ==========================================
# 3. SIDEBAR: USER INPUTS
# ==========================================
st.sidebar.header("Trip Configuration")

# Zone Selection
zone_list = zone_df['Zone'].unique()
pickup_zone = st.sidebar.selectbox("Pickup Location", zone_list, index=135) # Times Sq
dropoff_zone = st.sidebar.selectbox("Dropoff Location", zone_list, index=12) # Battery Park

# Date & Time (FIXED: Uses static default to prevent resetting)
travel_date = st.sidebar.date_input("Date", datetime.today())
# Default to 12:00 PM instead of "Now" to be stable
travel_time = st.sidebar.time_input("Time", time(12, 00)) 

st.sidebar.markdown("---")
st.sidebar.header("Conditions")
temperature = st.sidebar.slider("Temperature (°F)", 10, 100, 65)
is_rainy = st.sidebar.checkbox("Is it Raining?")
trip_dist = st.sidebar.number_input("Estimated Distance (miles)", 0.1, 50.0, 2.5)

# ==========================================
# 4. PREDICTION LOGIC
# ==========================================
def preprocess_input():
    pu_row = zone_df[zone_df['Zone'] == pickup_zone].iloc[0]
    do_row = zone_df[zone_df['Zone'] == dropoff_zone].iloc[0]
    
    travel_datetime = datetime.combine(travel_date, travel_time)
    hour = travel_datetime.hour
    dayofweek = travel_datetime.weekday()
    month = travel_datetime.month
    
    is_weekend = 1 if dayofweek >= 5 else 0
    is_rush_hour = 1 if hour in [7, 8, 9, 17, 18, 19] else 0
    
    input_data = pd.DataFrame({
        'trip_distance': [trip_dist],
        'pickup_hour': [hour],
        'pickup_dayofweek': [dayofweek],
        'pickup_month': [month],
        'is_weekend': [is_weekend],
        'is_rush_hour': [is_rush_hour],
        'temperature': [temperature],
        'is_rainy': [int(is_rainy)],
        'pickup_borough': [str(pu_row['Borough'])],
        'dropoff_borough': [str(do_row['Borough'])],
        'PULocationID': [pu_row['LocationID']],
        'DOLocationID': [do_row['LocationID']]
    })
    
    return input_data

# ==========================================
# 5. MAIN DASHBOARD UI
# ==========================================
st.title("UrbanFlow Analytics")
st.markdown("### Intelligent Trip Duration Forecasting")

# Show Image if it exists
if os.path.exists("outputs/big_three_showdown.png"):
    st.image("outputs/big_three_showdown.png", use_container_width=True, caption="Model Benchmark")
else:
    st.warning("Benchmark image not found in 'outputs/' folder.")

if st.button("Predict Trip Duration"):
    with st.spinner("Processing geospatial & weather data..."):
        input_df = preprocess_input()
        
        pred_lgbm = lgbm.predict(input_df)[0]
        pred_xgb = xgboost.predict(input_df)[0]
        pred_cat = catboost.predict(input_df)[0]
        avg_pred = (pred_lgbm + pred_xgb + pred_cat) / 3
        
        st.markdown("---")
        
        # Display Results with FIXED CSS
        c1, c2, c3, c4 = st.columns(4)
        
        def metric_card(label, value, color="#000000"):
            return f"""
            <div class='metric-card'>
                <div class='metric-label'>{label}</div>
                <div class='metric-value' style='color: {color} !important'>{value:.1f}</div>
                <div class='metric-unit'>minutes</div>
            </div>
            """
        
        with c1:
            st.markdown(metric_card("LightGBM", pred_lgbm), unsafe_allow_html=True)
        with c2:
            st.markdown(metric_card("XGBoost", pred_xgb), unsafe_allow_html=True)
        with c3:
            st.markdown(metric_card("CatBoost", pred_cat), unsafe_allow_html=True)
        with c4:
            # Red color for Ensemble
            st.markdown(metric_card("ENSEMBLE", avg_pred, "#ff4b4b"), unsafe_allow_html=True)

        st.success(f"**Prediction:** Based on current conditions ({temperature}°F, Rush Hour: {'Yes' if input_df['is_rush_hour'][0] else 'No'}), the trip will take approximately **{int(avg_pred)} minutes**.")