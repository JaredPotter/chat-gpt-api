import axios from "axios";

const chatGptApiUrl = process.env.CHAT_GPT_API_URL;
const MAX_ATTEMPTS = 5;
const RETRY_DELAY = 5000; // in milliseconds

async function queryChatGpt(query: string) {
  console.log(`chatGptQury: ${query}`);

  let attempts = 0;
  while (attempts < MAX_ATTEMPTS) {
    try {
      const url = `http://${chatGptApiUrl}/api/chat`;
      const response = await axios.post(url, {
        query,
      });

      const data = response.data.response;

      console.log(`chatGptResponse: ${JSON.stringify(data, null, 4)}`);

      return data;
    } catch (error) {
      attempts++;
      console.log(
        `Attempt ${attempts} failed. Retrying in ${
          RETRY_DELAY / 1000
        } seconds...`
      );
      if (attempts < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      } else {
        // TODO: notify twilio admin via SMS
        throw error;
      }
    }
  }
}

export default { queryChatGpt };
