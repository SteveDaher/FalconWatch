import json
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import make_pipeline
import joblib

# Load the sample dataset from JSON
with open('crime_data.json', 'r') as f:
    data = json.load(f)

# Convert JSON data to DataFrame
df = pd.DataFrame(data)

# Prepare the data
X = df['description']
y = df['severity']

# Split the data into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Create a pipeline that vectorizes the text and then applies a Naive Bayes classifier
model = make_pipeline(TfidfVectorizer(), MultinomialNB())

# Train the model
model.fit(X_train, y_train)

# Evaluate the model
accuracy = model.score(X_test, y_test)
print(f'Model Accuracy: {accuracy}')

# Save the model to a file
joblib.dump(model, 'crime_severity_model.joblib')
