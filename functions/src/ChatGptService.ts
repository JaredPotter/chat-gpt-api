import axios from "axios";

const chatGptApiUrl = process.env.CHAT_GPT_API_URL;

async function queryChatGpt(query: string) {
  try {
    const url = `http://${chatGptApiUrl}/api/chat`;
    console.log("url: " + url);
    const response = await axios.post(url, {
      query,
    });

    return response.data;
  } catch (error) {
    throw error;
  }
}

export default { queryChatGpt };
