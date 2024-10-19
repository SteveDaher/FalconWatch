# server/src/classify_severity.py
import sys
import joblib
import pandas as pd

# Load the model and encoders
model = joblib.load('crime_severity_model.joblib')
le_category = joblib.load('label_encoder_category.joblib')
le_severity = joblib.load('label_encoder_severity.joblib')

def classify_crime_severity(description, category):
    category = category.lower()
    if category not in le_category.classes_:
        return "Unknown"
    category_encoded = le_category.transform([category])[0]
    input_data = pd.DataFrame({
        'Description': [description],
        'Crime_category_encoded': [category_encoded],
        'Description_Length': [len(description)],
        'Contains_Weapon': [int('weapon' in description.lower())],
        'Is_Violent': [int('violent' in description.lower())],
        'Involves_Minor': [int('child' in description.lower())]
    })
    prediction = model.predict(input_data)
    return le_severity.inverse_transform(prediction)[0]

if __name__ == "__main__":
    description = sys.argv[1]
    category = sys.argv[2]
    severity = classify_crime_severity(description, category)
    print(severity)