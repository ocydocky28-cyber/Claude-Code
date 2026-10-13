# Remezzo Chatbot

An AI chat assistant that answers guest questions about **Remezzo**, the pizza and modern Italian restaurant at 568 North Rd, Ormond VIC 3204. It covers the menu, vegan and vegetarian options, bookings, takeaway ordering, location, amenities and reviews. For questions it has no facts for (prices, allergens, a day's opening hours) it points guests to the phone number, (03) 9578 8576, instead of guessing.

It runs on Claude (`claude-opus-5-5`) through the Anthropic API.

## Run it

You need Node.js 18 or newer and an Anthropic API key from https://console.anthropic.com.

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...   # Windows PowerShell: $env:ANTHROPIC_API_KEY="sk-ant-..."
npm start
```

Open http://localhost:3000 to chat. Set `PORT` to use a different port.

## Update what the bot knows

All restaurant facts live in [`restaurant-info.md`](restaurant-info.md). Add prices, full opening hours, specials or allergen notes there, then restart the server. The bot answers only from that file.

## Files

| File | Purpose |
| --- | --- |
| `server.js` | Web server. Serves the chat page and streams Claude's replies from `POST /api/chat`. |
| `restaurant-info.md` | The restaurant knowledge base the bot answers from. |
| `public/index.html` | The chat page, with suggested questions. Works on phones and in dark mode. |

## Notes

- Replies stream in as they are written. The system prompt is prompt-cached, so repeat questions cost less.
- Server-side refusal fallbacks are on (`fallbacks: "default"`): if a safety classifier declines a message, the API retries it on a recommended fallback model. Remove the `betas` and `fallbacks` lines in `server.js` to turn this off.
- The bot can't take bookings or orders. It sends guests to the phone number or the HungryHungry ordering site.
