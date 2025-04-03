// var http = require('http');
// var server = http.createServer(function(req, res) {
//     res.writeHead(200, {'Content-Type': 'text/plain'});
//     var message = 'It works!\n',
//         version = 'NodeJS ' + process.versions.node + '\n',
//         response = [message, version].join('\n');
//     res.end(response);
// });
// server.listen();

// Import required modules
const http = require('http');
const express = require('express');
const { Client } = require('@notionhq/client');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Initialize Notion client
const notion = new Client({
	auth: process.env.NOTION_API_KEY,
});

// Routes
app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint to get database structure
app.get('/api/database', async (req, res) => {
	try {
		const database = await notion.databases.retrieve({
			database_id: process.env.NOTION_DATABASE_ID,
		});
		res.json(database);
	} catch (error) {
		console.error('Error retrieving database:', error.stack); // Log full error stack
		res.status(500).json({ error: 'Failed to retrieve database', message: error.message }); // Include error message
	}
});

// Endpoint to update a page with an address
app.post('/api/update-address', async (req, res) => {
	const { pageId, propertyName, address, placeId, lat, lng } = req.body;

	try {
		 // Build properties object dynamically
		const properties = {
			[propertyName]: {
				rich_text: [{
					text: {
						content: address
					}
				}]
			}
		};

		// Update the page with the address data
		const response = await notion.pages.update({
			page_id: pageId,
			properties
		});

		res.json({ success: true, response });
	} catch (error) {
		console.error('Error updating page:', error.stack); // Log full error stack
		res.status(500).json({ error: 'Failed to update page', message: error.message }); // Include error message
	}
});

// Get pages from database
app.get('/api/pages', async (req, res) => {
	try {
		const response = await notion.databases.query({
			database_id: process.env.NOTION_DATABASE_ID,
			page_size: 100,
		});
		res.json(response);
	} catch (error) {
		console.error('Error querying database:', error.stack); // Log full error stack
		res.status(500).json({ error: 'Failed to query database', message: error.message }); // Include error message
	}
});

// Endpoint to expose Google API Key
app.get('/api/google-api-key', (req, res) => {
	try {
		res.json({ apiKey: process.env.GOOGLE_API_KEY });
	} catch (error) {
		console.error('Error exposing Google API Key:', error.stack); // Log full error stack
		res.status(500).json({ error: 'Failed to expose Google API Key', message: error.message }); // Include error message
	}
});

// Create HTTP server with Express
const server = http.createServer(app);

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
