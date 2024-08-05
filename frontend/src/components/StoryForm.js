import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './StoryForm.css';

const StoryForm = () => {
  const [characters, setCharacters] = useState([{ name: '', emotions: { happiness: 0, sadness: 0, fear: 0, disgust: 0, anger: 0, surprise: 0 } }]);
  const [scene, setScene] = useState('');
  const [scenario, setScenario] = useState('');
  const [story, setStory] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [stories, setStories] = useState([]);
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedStoryId, setSelectedStoryId] = useState(null);
  const [displayedStory, setDisplayedStory] = useState('');
  const [imageLoading, setImageLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState('');

  const backendUrl = 'https://cfac-2401-4900-1c43-65e9-29e7-ac0e-c0d1-2256.ngrok-free.app'; // Update with your ngrok URL

  const handleGenerateImage = async () => {
    if (!displayedStory.trim()) {
      alert('No story to generate image from');
      return;
    }

    const prompt = displayedStory.split(' ').slice(0, 10).join(' '); // Take first 10 words as prompt
    setImageLoading(true);

    try {
      const response = await axios.post(`${backendUrl}/generate_image`, {
        prompt,
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setImageUrl(response.data.image_path);
    } catch (error) {
      console.error('There was an error generating the image!', error);
      alert('There was an error generating the image!');
    }
    setImageLoading(false);
  };

  const handleSaveAsPdf = async () => {
    if (!displayedStory.trim() || !title.trim()) {
      alert('No story or title to save as PDF');
      return;
    }

    try {
      const response = await axios.post(`${backendUrl}/save_as_pdf`, {
        title,
        text: displayedStory,
        image_path: imageUrl,
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const link = document.createElement('a');
      link.href = `${backendUrl}/${response.data.pdf_path}`;
      link.download = `${title}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('There was an error saving the PDF!', error);
      alert('There was an error saving the PDF!');
    }
  };

  const handleChange = (index, event) => {
    const values = [...characters];
    if (event.target.name === 'name') {
      values[index].name = event.target.value;
    } else {
      values[index].emotions[event.target.name] = event.target.value;
    }
    setCharacters(values);
  };

  const handleAddCharacter = () => {
    setCharacters([...characters, { name: '', emotions: { happiness: 0, sadness: 0, fear: 0, disgust: 0, anger: 0, surprise: 0 } }]);
  };

  const handleRemoveCharacter = (index) => {
    const values = [...characters];
    values.splice(index, 1);
    setCharacters(values);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${backendUrl}/generate`, {
        characters,
        scene,
        scenario,
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setStory(response.data.story);
    } catch (error) {
      console.error('There was an error generating the story!', error);
    }
    setLoading(false);
  };

  const handleReset = () => {
    setCharacters([{ name: '', emotions: { happiness: 0, sadness: 0, fear: 0, disgust: 0, anger: 0, surprise: 0 } }]);
    setScene('');
    setScenario('');
    setStory('');
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    alert('Story copied to clipboard!');
  };

  const handleSave = async () => {
    try {
      await axios.post(`${backendUrl}/save`, {
        title,
        content: story,
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      alert('Story saved successfully!');
      fetchStories();
    } catch (error) {
      console.error('There was an error saving the story!', error);
    }
  };

  const handleRegister = async () => {
    try {
      await axios.post(`${backendUrl}/register`, {
        username,
        password
      });
      alert('User registered successfully!');
    } catch (error) {
      console.error('There was an error registering the user!', error);
    }
  };

  const handleLogin = async () => {
    try {
      const response = await axios.post(`${backendUrl}/login`, {
        username,
        password
      });
      setToken(response.data.access_token);
      alert('User logged in successfully!');
      fetchStories();
    } catch (error) {
      console.error('There was an error logging in the user!', error);
    }
  };

  const fetchStories = async () => {
    try {
      const response = await axios.get(`${backendUrl}/stories`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setStories(response.data.stories);
    } catch (error) {
      console.error('There was an error fetching the stories!', error);
    }
  };

  const handleDeleteStory = async (storyId) => {
    try {
      await axios.delete(`${backendUrl}/delete/${storyId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      alert('Story deleted successfully!');
      fetchStories();
    } catch (error) {
      console.error('There was an error deleting the story!', error);
    }
  };

  const handleDisplayStory = async () => {
    if (selectedStoryId) {
      try {
        const response = await axios.get(`${backendUrl}/story/${selectedStoryId}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setDisplayedStory(response.data.content);
      } catch (error) {
        console.error('There was an error fetching the story!', error);
      }
    }
  };

  useEffect(() => {
    if (token) {
      fetchStories();
    }
  }, [token]);

  return (
    <div className="story-form">
      <h1>TaleTailor AI</h1>

      {token ? (
        <>
          <form onSubmit={handleSubmit}>
            {characters.map((character, index) => (
              <div key={index} className="character-box">
                <input
                  type="text"
                  name="name"
                  placeholder="Character Name"
                  value={character.name}
                  onChange={(event) => handleChange(index, event)}
                />
                {Object.keys(character.emotions).map((emotion) => (
                  <div key={emotion}>
                    <label>{emotion}</label>
                    <input
                      type="range"
                      name={emotion}
                      min="0"
                      max="100"
                      value={character.emotions[emotion]}
                      onChange={(event) => handleChange(index, event)}
                    />
                  </div>
                ))}
                <button type="button" onClick={() => handleRemoveCharacter(index)}>Remove Character</button>
              </div>
            ))}
            <button type="button" onClick={handleAddCharacter}>Add Character</button>
            <input
              type="text"
              placeholder="Scene"
              value={scene}
              onChange={(event) => setScene(event.target.value)}
            />
            <input
              type="text"
              placeholder="Scenario"
              value={scenario}
              onChange={(event) => setScenario(event.target.value)}
            />
            <button type="submit">Generate Story</button>
            <button type="button" onClick={handleReset}>Reset</button>
          </form>
          {loading ? <p>Loading...</p> : story && (
            <div className="story-box">
              <h2>Generated Story</h2>
              <p>{story}</p>
              <input
                type="text"
                placeholder="Title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              <button onClick={() => handleCopy(story)}>Copy Story</button>
              <button onClick={handleSave}>Save Story</button>
            </div>
          )}

          <h2>Saved Stories</h2>
          <ul>
            {stories.length > 0 ? (
              stories.map(story => (
                <li key={story.id}>
                  <input
                    type="radio"
                    name="selectedStory"
                    value={story.id}
                    onChange={() => setSelectedStoryId(story.id)}
                    checked={selectedStoryId === story.id}
                  />
                  <span>{story.title}</span>
                  <button onClick={() => handleDeleteStory(story.id)}>Delete</button>
                </li>
              ))
            ) : (
              <li>No stories found.</li>
            )}
          </ul>
          <button onClick={handleDisplayStory}>Display Story</button>
          {displayedStory && (
            <div className="story-box">
              <h2>Displayed Story</h2>
              <p>{displayedStory}</p>
              <button onClick={() => handleCopy(displayedStory)}>Copy Displayed Story</button>
              <button onClick={handleGenerateImage}>Generate Image</button>
              {imageLoading && <div className="loading">Generating image...</div>}
              {imageUrl && <img src={`${backendUrl}/${imageUrl}`} alt="Generated" />}
              <button onClick={handleSaveAsPdf}>Save as PDF</button>
            </div>
          )}
        </>
      ) : (
        <div>
          <h2>Register / Login</h2>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button onClick={handleRegister}>Register</button>
          <button onClick={handleLogin}>Login</button>
        </div>
      )}
    </div>
  );
};

export default StoryForm;
