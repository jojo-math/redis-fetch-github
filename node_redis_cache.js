const express = require('express');
//const fetch = require('node-fetch');
const { createClient } = require('redis');
//configuration du port serveur : 5000
const PORT = process.env.PORT || 5000;
// configuration du port redis
const REDIS_PORT = process.env.REDIS_PORT || 6379;
//url d'acces au donnees sauvegardees temporairement sur Redis
const client = createClient({ url: `redis://localhost:${REDIS_PORT}` });
//le client se connecte, s'il y'a une erreur, elle est capturee et retournee dans les logs
client.connect().catch(console.error);

const app = express();

// Set response : retourne une vue html pour afficher le resultat
function setResponse(username, repos, rep) {
  return `<h2>${username} has ${repos} Github repos : </h2><hr>${rep}`;
}

// Make request to Github for data
async function getRepos(req, res, next) {
  try {
    // tentative de recuperation des donnees
    console.log('Fetching Data...');
    const { username } = req.params;
    //methode asynchrone pour recuperer le nom de l'utilisateur
    const response = await fetch(`https://api.github.com/users/${username}`);
    //methode asynchrone pour recuperer la liste des depots de l'utilisateur
    const rep_repos = await fetch(`https://api.github.com/users/${username}/repos`);
    const data = await response.json();
    const rep_data = await rep_repos.json();
    const repos = data.public_repos;
    const rep = rep_data.map(repo => `<p><a href="${repo.html_url}">${repo.name}</a></p>`).join('');

    // Set data to Redis (serialize repos and rep together)
    await client.setEx(username, 3600, JSON.stringify({ repos, rep }));

    res.send(setResponse(username, repos, rep));
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
      // Deserialize repos and rep from cache
      const { repos, rep } = JSON.parse(data);
      res.send(setResponse(username, repos, rep));
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
