const puppeteer = require('puppeteer');
const express = require('express');
const fs = require('fs');
const asyncLock = require('async-lock');
const lock = new asyncLock();

const app = express();
app.use(express.json());
const puppeteerTimeout = 90000;
const COOKIES_PATH = './cookies/latest_cookies.json';
let page;

app.post('/api/chat', async (request, response) => {
  const query = request.body.query;
  console.log(`/api/chat CALLED - query: ${query}`);
  let responseMessage = '';

  try {
    await lock.acquire('resourceLock', async (done) => {
      responseMessage = await queryChatGpt(page, query);
      done();
    });
  } catch (err) {
    console.error(err);
    response.status(500).send('Failed to acquire lock');
    return;
  }

  response.send({
    response: responseMessage,
  });
});

async function openChatGpt() {
  console.log('Opening Chrome Window and chat.openai.com...');

  const headless = false; // headless = true seems not to work with chatGPT
  const browser = await puppeteer.launch({
    headless,
    timeout: 20000,
    ignoreHTTPSErrors: true,
    slowMo: 0,
    args: [
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox',
      '--no-first-run',
      '--no-sandbox',
      '--no-zygote',
      '--window-size=1280,720',
    ],
  });
  page = await browser.newPage();
  await page.goto('https://chat.openai.com/');

  const cookies = JSON.parse(
    fs.readFileSync(COOKIES_PATH, {
      encoding: 'utf-8',
    })
  );

  try {
    await page.setCookie(...cookies);
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
    );
    await page.goto('https://chat.openai.com/');
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCache');
    await page.reload({ waitUntil: 'networkidle0' });
    const refreshedCookies = await page.cookies();
    fs.writeFile(
      COOKIES_PATH,
      JSON.stringify(refreshedCookies, null, 4),
      () => {}
    );

    // Delete welcome modal
    await page.evaluate(() => {
      const element = document.querySelector('.absolute.inset-0');
      if (element) {
        element.remove();
      }
    });
  } catch (error) {
    console.error(error);
    debugger;
  }
}

async function queryChatGpt(page, message) {
  let isCodeResponse = false;

  if (message.includes('code block')) {
    isCodeResponse = true;
  }

  const messageTextboxElement = await page.waitForSelector('#prompt-textarea', {
    timeout: puppeteerTimeout,
  });
  await messageTextboxElement.type(message);
  await page.keyboard.press('Enter');
  const buttonXPath =
    '//button[@as="button"]//div[contains(text(), "Regenerate response")]';
  await page.waitForXPath(buttonXPath, { timeout: puppeteerTimeout });
  const responseMessage = await page.evaluate((isCodeResponse) => {
    const responseMessageCodeSelector = '#__next code';
    const responseMessageSelector =
      '#__next > div.overflow-hidden.w-full.h-full.relative.flex.z-0 > div > div > main > div.flex-1.overflow-hidden > div > div > div > div > div > div.gap-1';
    let mostRecentMessage = '';

    if (isCodeResponse) {
      const codeBlocks = document.querySelectorAll(responseMessageCodeSelector);
      const mostRecentCodeBlockNode = codeBlocks[codeBlocks.length - 1];
      mostRecentMessage = JSON.parse(mostRecentCodeBlockNode.textContent);
    } else {
      const messages = document.querySelectorAll(responseMessageSelector);
      const mostRecentMessageNode = messages[messages.length - 1];
      mostRecentMessage = mostRecentMessageNode.textContent;

      mostRecentMessage = mostRecentMessage.replace('1 / 1', '');
    }

    return mostRecentMessage;
  }, isCodeResponse);

  return responseMessage;
}

(async () => {
  if (process.argv[2] === 'isDev') {
    // const message = await openChatGpt();
    // console.log(message);
  }

  await openChatGpt();

  app.listen(3000, () => {
    console.log('Server Started');
  });
})();
