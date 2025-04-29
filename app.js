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
	// Extract locality, state, and country from the request body
	const { pageId, propertyName, address, placeId, lat, lng, url, website, name, locality, state, country } = req.body;

	// Ensure these values are defined or default to empty strings
	const localityValue = locality || '';
	const stateValue = state || '';
	const countryValue = country || '';

	try {
		// Retrieve the current page details
		const page = await notion.pages.retrieve({ page_id: pageId });
		const currentPageName = page.properties.title?.title?.[0]?.text?.content || '';

		// Check if the name is different from the current page name
		if (name && name !== currentPageName) {
			// Update the page name
			await notion.pages.update({
				page_id: pageId,
				properties: {
					title: {
						title: [
							{
								text: {
									content: name
								}
							}
						]
					}
				}
			});
		}

		// Build properties object dynamically
		const properties = {
			[propertyName]: {
				rich_text: [
					{
						text: {
							content: address
						}
					}
				]
			},
			"Place ID": {
				rich_text: [
					{
						text: {
							content: placeId
						}
					}
				]
			},
			"URL": {
				url: url
			},
			"Website": {
				url: website
			},
			"Latitude": {
				rich_text: [
					{
						text: {
							content: lat.toString()
						}
					}
				]
			},
			"Longitude": {
				rich_text: [
					{
						text: {
							content: lng.toString()
						}
					}
				]
			},
			"Locality": {
				select: {
					name: localityValue
				}
			},
			"State": {
				select: {
					name: stateValue
				}
			},
			"Country": {
				select: {
					name: countryValue
				}
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

// Webhook endpoint to handle Notion events
app.post('/api/webhook', async (req, res) => {
	const event = req.body;

	if (event.challenge) return res.status(200).send(event.challenge);

	if (event.type === 'page.created') {
		const pageId = event.entity.id;

		try {
			const page = await notion.pages.retrieve({ page_id: pageId });

			const inputAddress = page.properties["Address"]?.rich_text?.[0]?.text?.content;

			console.log('Input address:', inputAddress); // Log the input address

			if (!inputAddress) return res.status(200).send('No address provided.');

			// Call your autocomplete API (already implemented)
			const autocompleteRes = await fetch('https://notion-api-address-autocomplete.blank-space.online/api/autocomplete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ input: inputAddress })
			});

			const data = await autocompleteRes.json();

			console.log('Autocomplete data:', data); // Log the autocomplete data

			console.log("Sending update to Notion:", pageId, data);

			// Update Notion page using your API
			await fetch('https://notion-api-address-autocomplete.blank-space.online/api/update-address', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					pageId,
					propertyName: "Address", // still the same
					...data // includes Website, URL, Latitude, Longitude, Locality, State, Country
				})
			});

			console.log("Update address request body:", req.body); // Log the request body

			res.status(200).send('Autocomplete completed and fields updated');
		} catch (error) {
			console.error('Error processing webhook:', error);
			res.status(500).send('Webhook processing failed');
		}
	} else {
		res.status(200).send('Unhandled event type');
	}
});

// Create HTTP server with Express
const server = http.createServer(app);

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
