const express = require('express');
//const fetch = require('node-fetch');
const { createClient } = require('redis');

const PORT = process.env.PORT || 5000;
const REDIS_PORT = process.env.REDIS_PORT || 6379;

const client = createClient({ url: `redis://localhost:${REDIS_PORT}` });

client.connect().catch(console.error);

const app = express();

// Set response
function setResponse(username, repos) {
  return `<h2>${username} has ${repos} Github repos</h2>`;
}

// Make request to Github for data
async function getRepos(req, res, next) {
  try {
    console.log('Fetching Data...');
    const { username } = req.params;
    const response = await fetch(`https://api.github.com/users/${username}`);
    const data = await response.json();
    const repos = data.public_repos;

    // Set data to Redis
    await client.setEx(username, 3600, repos.toString());

    res.send(setResponse(username, repos));
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
}

// Cache middleware
async function cache(req, res, next) {
  const { username } = req.params;
  try {
    const data = await client.get(username);
    if (data !== null) {
      res.send(setResponse(username, data));
    } else {
      next();
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Redis Error');
  }
}

app.get('/repos/:username', cache , getRepos);

app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});