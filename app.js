const express = require('express');
const session = require('express-session');
const passport = require('passport');
const TwitchStrategy = require('passport-twitch-new').Strategy;
const mysql = require('mysql2');
const path = require('path');
const axios = require('axios'); // Add axios to make HTTP requests

const app = express();
const port = 3000;

// Serve static files from the "public" directory (including your index.html)
app.use(express.static(path.join(__dirname, 'public')));

// Database connection
const connection = mysql.createConnection({
    host: 'localhost', port: 3306, user: 'smallstreamerawardsuser', password: 'smallstreamerawardsuser@123', database: 'smallstreamerawardsdb'
});

connection.connect(err => {
    if (err) {
        console.error('Error connecting to MariaDB:', err.stack);
        return;
    }
    console.log('Connected to MariaDB');
});

// Session management
app.use(session({
    secret: 'your-secret-key', resave: false, saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

// Twitch OAuth2 strategy (as you had before)
passport.use(new TwitchStrategy({
    clientID: 'zzds8ws0st10vxfa3568snakvm31m1', clientSecret: '6564a6vsn090hyyt8bu9mae3xc7bjf', callbackURL: 'https://smallstreamawards.de/auth/twitch/callback', scope: 'user:read:email'
}, async function (accessToken, refreshToken, profile, done) {
    console.log('Basic Twitch profile:', profile);

    try {
        const helixResponse = await axios.get('https://api.twitch.tv/helix/users', {
            headers: {
                'Authorization': `Bearer ${accessToken}`, 'Client-Id': 'zzds8ws0st10vxfa3568snakvm31m1'
            }
        });

        const userProfile = helixResponse.data.data[0];
        console.log('Detailed Twitch Helix profile:', userProfile);

        const id = userProfile.login;
        const email = userProfile.email;
        const twitchId = userProfile.id;
        const username = userProfile.display_name || userProfile.login;

        connection.query('SELECT * FROM twitch_users WHERE id = ?', [id], (err, results) => {
            if (err) return done(err);

            if (results.length === 0) {
                connection.query('INSERT INTO twitch_users (id, username, twitch_id, email) VALUES (?, ?, ?, ?)', [id, username, twitchId, email], (err, result) => {
                    if (err) return done(err);
                    return done(null, {id: result.insertId, username: username});
                });
            } else {
                return done(null, results[0]);
            }
        });
    } catch (error) {
        console.error('Error fetching profile from Twitch Helix:', error);
        return done(error);
    }
}));

// Serialize and deserialize user
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    connection.query('SELECT * FROM twitch_users WHERE id = ?', [id], (err, results) => {
        if (err) return done(err);
        done(null, results[0]);
    });
});

// Store logs
let logs = [];

// Override console.log and console.error
const originalLog = console.log;
const originalError = console.error;

console.log = function (...args) {
    logs.push({type: 'log', message: args.join(' '), timestamp: new Date()});
    originalLog.apply(console, args);
};

console.error = function (...args) {
    logs.push({type: 'error', message: args.join(' '), timestamp: new Date()});
    originalError.apply(console, args);
};

// Endpoint to fetch logs
app.get('/api/logs', (req, res) => {
    res.json(logs);
});

// Clear logs endpoint (optional)
app.get('/api/clear-logs', (req, res) => {
    logs = [];
    res.json({success: true, message: 'Logs cleared'});
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
