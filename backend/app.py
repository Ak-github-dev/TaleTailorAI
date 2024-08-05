from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_mysqldb import MySQL
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from ai71 import AI71

from transformers import CLIPTextModel, CLIPTokenizer
from diffusers import StableDiffusionPipeline
import torch

from dotenv import load_dotenv
import os

from fpdf import FPDF



#app = Flask(__name__)
app = Flask(__name__, static_folder='story-generator')

CORS(app)

load_dotenv()
AI71_API_KEY = os.getenv('AI71_API_KEY')
app.config['MYSQL_USER'] = os.getenv('MYSQL_USER')
app.config['MYSQL_PASSWORD'] = os.getenv('MYSQL_PASSWORD')
app.config['MYSQL_DB'] = os.getenv('MYSQL_DB')
app.config['MYSQL_HOST'] = os.getenv('MYSQL_HOST')


# Load configuration from environment variables
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY')
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY')

jwt = JWTManager(app)


mysql = MySQL(app)
bcrypt = Bcrypt(app)
jwt = JWTManager(app)


client = AI71(AI71_API_KEY)

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')

    cursor = mysql.connection.cursor()
    cursor.execute("INSERT INTO users (username, password) VALUES (%s, %s)", (username, hashed_password))
    mysql.connection.commit()
    cursor.close()

    return jsonify({'message': 'User registered successfully'})

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    cursor = mysql.connection.cursor()
    cursor.execute("SELECT id, password FROM users WHERE username = %s", (username,))
    user = cursor.fetchone()
    cursor.close()

    if user and bcrypt.check_password_hash(user[1], password):
        access_token = create_access_token(identity={'id': user[0], 'username': username})
        return jsonify({'access_token': access_token})
    else:
        return jsonify({'message': 'Invalid credentials'}), 401

@app.route('/generate', methods=['POST'])
@jwt_required()
def generate_story():
    data = request.get_json()
    characters = data['characters']
    scene = data['scene']
    scenario = data['scenario']
    
    character_descriptions = ", ".join([f"{char['name']} who is feeling {char['emotions']}" for char in characters])
    prompt = f"Write a detailed and creative story in the {scene} scene where {character_descriptions}. Scenario: {scenario}."

    try:
        response = client.chat.completions.create(
            model="tiiuae/falcon-180B-chat",
            messages=[
                {"role": "system", "content": "You are a creative story writer."},
                {"role": "user", "content": prompt},
            ],
        )
        story = response.choices[0].message.content
        if "inappropriate" in story.lower():
            story = "The story cannot be generated due to inappropriate content."
        return jsonify({'story': story})
    except Exception as e:
        return jsonify({'error': str(e)})

@app.route('/save', methods=['POST'])
@jwt_required()
def save_story():
    data = request.get_json()
    user_id = get_jwt_identity()['id']
    title = data.get('title')
    content = data.get('content')

    cursor = mysql.connection.cursor()
    cursor.execute("INSERT INTO stories (user_id, title, content) VALUES (%s, %s, %s)", (user_id, title, content))
    mysql.connection.commit()
    cursor.close()

    return jsonify({'message': 'Story saved successfully'})

@app.route('/stories', methods=['GET'])
@jwt_required()
def get_stories():
    user_id = get_jwt_identity()['id']

    cursor = mysql.connection.cursor()
    cursor.execute("SELECT id, title FROM stories WHERE user_id = %s", (user_id,))
    stories = cursor.fetchall()
    cursor.close()

    return jsonify({'stories': [{'id': story[0], 'title': story[1]} for story in stories]})

@app.route('/story/<int:story_id>', methods=['GET'])
@jwt_required()
def get_story(story_id):
    user_id = get_jwt_identity()['id']

    cursor = mysql.connection.cursor()
    cursor.execute("SELECT id, title, content FROM stories WHERE id = %s AND user_id = %s", (story_id, user_id))
    story = cursor.fetchone()
    cursor.close()

    if story:
        return jsonify({'id': story[0], 'title': story[1], 'content': story[2]})
    else:
        return jsonify({'message': 'Story not found'}), 404

@app.route('/delete/<int:story_id>', methods=['DELETE'])
@jwt_required()
def delete_story(story_id):
    user_id = get_jwt_identity()['id']

    cursor = mysql.connection.cursor()
    cursor.execute("DELETE FROM stories WHERE id = %s AND user_id = %s", (story_id, user_id))
    mysql.connection.commit()
    cursor.close()

    return jsonify({'message': 'Story deleted successfully'})





def generate_image(prompt, model_name="CompVis/stable-diffusion-v1-4", height=256, width=256):
    # Load pre-trained models
    tokenizer = CLIPTokenizer.from_pretrained("openai/clip-vit-large-patch14")
    text_encoder = CLIPTextModel.from_pretrained("openai/clip-vit-large-patch14")
    pipe = StableDiffusionPipeline.from_pretrained(model_name, torch_dtype=torch.float32)
    pipe = pipe.to("cpu")

    # Generate text embedding
    text_inputs = tokenizer(prompt, return_tensors="pt", max_length=77, padding="max_length", truncation=True)
    text_embeddings = text_encoder(**text_inputs).last_hidden_state

    # Generate image with lower resolution
    with torch.no_grad():
        images = pipe(prompt, height=height, width=width).images

    # Save the image
    image_path = f"generated_image_{hash(prompt)}.png"
    images[0].save(image_path)
    return image_path

@app.route('/generate_image', methods=['POST'])
@jwt_required()
def generate_image_route():
    data = request.get_json()
    prompt = data.get('prompt')

    try:
        image_path = generate_image(prompt)
        return jsonify({'image_path': f'{image_path}'})
    except Exception as e:
        return jsonify({'error': str(e)})







def save_as_pdf(story_title, story_text, image_path):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)

    # Add title
    pdf.set_font("Arial", 'B', size=16)
    pdf.cell(200, 10, txt=story_title, ln=True, align='C')

    # Add image
    if image_path:
        pdf.image(image_path, x=10, y=20, w=100)

    # Add story text
    pdf.set_font("Arial", size=12)
    pdf.ln(85)  # Move below the image
    pdf.multi_cell(0, 10, story_text)

    # Save PDF
    pdf_path = f"{story_title}.pdf"
    pdf.output(pdf_path)
    return pdf_path

@app.route('/save_as_pdf', methods=['POST'])
@jwt_required()
def save_as_pdf_route():
    data = request.get_json()
    story_title = data.get('title')
    story_text = data.get('text')
    image_path = data.get('image_path')

    try:
        pdf_path = save_as_pdf(story_title, story_text,f"{image_path}")
        return jsonify({'pdf_path': pdf_path})
    except Exception as e:
        return jsonify({'error': str(e)})






if __name__ == '__main__':
    app.run(debug=True)
