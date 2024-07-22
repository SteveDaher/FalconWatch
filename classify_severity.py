import sys
import joblib

# Load the pre-trained model
model = joblib.load('crime_severity_model.joblib')

def classify_description(description):
    # Predict the severity
    prediction = model.predict([description])
    return prediction[0]

if __name__ == "__main__":
    description = sys.argv[1]
    severity = classify_description(description)
    print(severity)
