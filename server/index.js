const puppeteer = require("puppeteer");
const express = require("express");
const fs = require("fs-extra");
const axios = require("axios");
const { spawn, spawnSync } = require("child_process");
const asyncLock = require("async-lock");
const lock = new asyncLock();

fs.ensureDirSync("../cookies");

const app = express();
app.use(express.json());
const puppeteerTimeout = 90000;
const COOKIES_PATH = "../cookies/latest_cookies.json";
const WINDOW_HEIGHT = 1500;
const WINDOW_WIDTH = 1000;
let page;

const IS_DEV = process.argv[2] === "--is_dev" ? true : false;

console.log("IS_DEV: " + IS_DEV);

app.post("/api/chat", async (request, response) => {
  const query = request.body.query;
  console.log(`/api/chat CALLED - query: ${query}`);
  let responseMessage = "";

  try {
    await lock.acquire("resourceLock", async (done) => {
      responseMessage = await queryChatGpt(page, query);
      done();
    });
  } catch (err) {
    console.error(err);
    response.status(500).send("Failed to acquire lock");
    return;
  }

  response.send({
    response: responseMessage,
  });
});

app.get("/api/set-cookies", async (request, response) => {
  console.log(`/api/set-cookies CALLED`);

  await openChrome();

  try {
    await openChatGpt();
  } catch (error) {
    response.send(
      "Failed to set cookies. Please login and recall GET /api/set-cookies endpoint."
    );
    return;
  }

  console.log("Successfully set cookies");
  response.send("Successfully set cookies");
});

async function openChatGpt() {
  console.log("Opening chat.openai.com...");

  await page.goto("https://chat.openai.com/");

  let cookies = "";

  try {
    cookies = JSON.parse(
      fs.readFileSync(COOKIES_PATH, {
        encoding: "utf-8",
      })
    );
  } catch (error) {
    console.error(error);
    console.error("Failed to find latest_cookies.json.");
    console.error("Attempting to get cookies.");

    try {
      await page.waitForSelector("#prompt-textarea");
    } catch (error) {
      console.error(
        "Please login into chatGPT and re-call /api/set-cookies endpoint."
      );
      throw error;
    }
  }

  try {
    if (cookies) {
      await page.setCookie(...cookies);
    }

    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
    );
    await page.goto("https://chat.openai.com/");
    const client = await page.target().createCDPSession();
    await client.send("Network.clearBrowserCache");
    await page.reload({ waitUntil: "networkidle0" });
    const refreshedCookies = await page.cookies();
    fs.writeFile(
      COOKIES_PATH,
      JSON.stringify(refreshedCookies, null, 4),
      () => {}
    );

    // Get Model
    const modalHeaderText = await page.evaluate(() => {
      const modalElement = document.querySelector(".absolute.inset-0");

      if (modalElement) {
        const modalHeaderElement = modalElement.querySelector("h2");

        if (modalHeaderElement) {
          const modalHeaderText = modalHeaderElement.textContent;

          if (modalHeaderText === "Your session has expired") {
            return modalHeaderText;
          } else if (modalHeaderText === "some intro...") {
            modalElement.remove();
          }
        }
      }

      return "";
    });

    if (modalHeaderText === "Your session has expired") {
      console.log("chatGpt session expired. Please log back in.");

      try {
        fs.unlinkSync(COOKIES_PATH);
      } catch (error) {
        /* nothing */
      }

      await page.goto("https://chat.openai.com/auth/login");

      const loginButtonElement = await page.waitForSelector("button");
      loginButtonElement.click();
    }
  } catch (error) {
    console.error(error);
  }
}

async function queryChatGpt(
  page,
  message,
  isOutputArray = false,
  batchPrompt = null
) {
  let isJsonResponse = false;

  if (message.includes("code block")) {
    isJsonResponse = true;
  }

  // Open new chat
  await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll("a"));
    const targetLink = links.find((link) =>
      link.textContent.includes("New chat")
    );
    if (targetLink) {
      targetLink.click();
    }
  });

  const messageTextboxSelector = await page.waitForSelector(
    "#prompt-textarea",
    {
      timeout: puppeteerTimeout,
    }
  );

  await page.evaluate(
    (selector, value) => {
      document.querySelector(selector).value = value;
    },
    "#prompt-textarea",
    message
  );

  await messageTextboxSelector.type(" ");
  await page.keyboard.press("Enter");

  const regenerateButtonXPath =
    '//button[@as="button"]//div[contains(text(), "Regenerate")]';
  await page.waitForXPath(regenerateButtonXPath, { timeout: puppeteerTimeout });

  const responseMessage = await page.evaluate(
    async (parameters) => {
      const chatMessages = document.querySelectorAll(".items-start");
      let mostRecentMessage = chatMessages[chatMessages.length - 1];
      let resultMessage = "";

      // Attempt to get a <code> block.
      if (parameters.isJsonResponse) {
        const responseMessageCodeSelector = "code";
        const codeElement = mostRecentMessage.querySelector(
          responseMessageCodeSelector
        );

        try {
          resultMessage = JSON.parse(codeElement.textContent);
        } catch (error) {
          console.log("Failed to find/parse <code> block. Attempt manually.");

          // Attempt to get JSON via manual parsing.
          const mostRecentMessageElement =
            mostRecentMessage.querySelector(".markdown.prose");
          mostRecentMessage = mostRecentMessageElement.textContent;

          try {
            resultMessage = JSON.parse(mostRecentMessage);
          } catch (error) {
            // failed. Try manual parse.
          }

          console.log("attempting manual parse on: " + mostRecentMessage);
          const text = mostRecentMessage;

          try {
            let stack = [];
            let jsons = [];
            let start = -1;

            for (let i = 0; i < text.length; i++) {
              let char = text[i];

              // Push the index onto the stack when we meet an opening bracket
              if (char === "{" || char === "[") {
                stack.push(i);
                if (start === -1) start = i;
              }

              // When we meet a closing bracket, we check if the stack is empty after popping
              // If it is, then we know this is an outermost closing bracket
              if (char === "}" || char === "]") {
                stack.pop();
                if (stack.length === 0) {
                  // Extract the JSON and add it to the list
                  let jsonText = text.slice(start, i + 1);
                  try {
                    let json = JSON.parse(jsonText);
                    jsons.push(json);
                    start = -1;
                  } catch (err) {
                    console.log("Failed to parse:", jsonText);
                  }
                }
              }
            }

            responseMessage = jsons[0];
            // const startIndices = [
            //   mostRecentMessage.indexOf('{'),
            //   mostRecentMessage.indexOf('['),
            // ];
            // const validStartIndex = Math.min(...startIndices.filter(Boolean));

            // if (validStartIndex !== -1) {
            //   let depth = 0;
            //   for (let i = validStartIndex; i < mostRecentMessage.length; i++) {
            //     if (
            //       mostRecentMessage[i] === '{' ||
            //       mostRecentMessage[i] === '['
            //     ) {
            //       depth++;
            //     } else if (
            //       mostRecentMessage[i] === '}' ||
            //       mostRecentMessage[i] === ']'
            //     ) {
            //       depth--;
            //       if (depth === 0) {
            //         try {
            //           resultMessage = JSON.parse(
            //             mostRecentMessage.substring(validStartIndex, i + 1)
            //           );
            //           break;
            //         } catch (e) {
            //           console.log('Invalid JSON detected');
            //         }
            //       }
            //     }
            //   }
            // }
          } catch (error) {
            console.log(JSON.stringify(error, null, 4));
          }
        }
      } else {
        mostRecentMessage = mostRecentMessage.textContent;

        resultMessage = mostRecentMessage.replace("1 / 1", "");
      }

      console.log("resultMessage: " + JSON.stringify(resultMessage, null, 4));

      return resultMessage;
    },
    {
      isJsonResponse,
      extractJSON,
    }
  );

  console.log("responseMessage: " + JSON.stringify(responseMessage, null, 4));

  return responseMessage;
}

async function extractJSON(string) {
  let jsonObject;

  try {
    const startIndices = [string.indexOf("{"), string.indexOf("[")];
    const validStartIndex = Math.min(...startIndices.filter(Boolean));

    if (validStartIndex !== -1) {
      let depth = 0;
      for (let i = validStartIndex; i < string.length; i++) {
        if (string[i] === "{" || string[i] === "[") {
          depth++;
        } else if (string[i] === "}" || string[i] === "]") {
          depth--;
          if (depth === 0) {
            try {
              jsonObject = JSON.parse(string.substring(validStartIndex, i + 1));
              break;
            } catch (e) {
              console.log("Invalid JSON detected");
            }
          }
        }
      }
    }
  } catch (error) {
    console.error(error);

    return null;
  }

  return jsonObject;
}

async function openChrome() {
  if (process.platform === "darwin") {
    console.log("Running on Mac");
    spawnSync("killall", [`Google Chrome`]);
    chromeLauncher = `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`;
  } else if (process.platform === "linux") {
    console.log("Running on Linux");
    spawnSync("killall", [`google-chrome`]);
    chromeLauncher = `/usr/bin/google-chrome`;
  }

  chromeLauncherFlags = [
    "--remote-debugging-port=9222",
    "--no-first-run",
    "--no-default-browser-check",
    `--window-size=${WINDOW_WIDTH},${WINDOW_HEIGHT}`,
    // `--user-data-dir=$(mktemp -d -t "chrome-remote_data_dir)"`,
  ];

  if (process.platform === "linux") {
    chromeLauncherFlags.push("--headless");
  }

  if (IS_DEV) {
    chromeLauncherFlags.push("--auto-open-devtools-for-tabs");
  }
  const wsChromeEndpointUrl = await startChromeProcess(
    chromeLauncher,
    chromeLauncherFlags
  );

  if (!wsChromeEndpointUrl) {
    console.log("Failed to load websocket URL. Exiting now!");
    return;
  }

  const browser = await puppeteer.connect({
    browserWSEndpoint: wsChromeEndpointUrl,
    timeout: 20000,
    ignoreHTTPSErrors: true,
    slowMo: 0,
    args: [
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-setuid-sandbox",
      "--no-first-run",
      "--no-sandbox",
      "--no-zygote",
      `--window-size=${WINDOW_WIDTH},${WINDOW_HEIGHT}`,
    ],
  });

  page = await browser.newPage();
}

async function closeChrome() {
  if (process.platform === "win32") {
    crossSpawnSync("powershell", ["kill", "-n", "chrome"]);
  } else if (process.platform === "darwin" || process.platform === "linux") {
    crossSpawnSync("killall", [`Google Chrome`]);
  } else if (process.platform === "linux") {
    crossSpawnSync("killall", [`google-chrome`]);
  }
}

async function startChromeProcess(chromeLauncher, chromeLauncherFlags) {
  // Starts Chrome
  try {
    const chromeStartCommand = `${chromeLauncher} ${chromeLauncherFlags.join(
      " "
    )}`;
    console.log(`Running \n${chromeStartCommand}`);

    spawn(chromeLauncher, chromeLauncherFlags, { stdio: "inherit" });
  } catch (error) {
    // do nothing.
  }

  await sleep(2500);

  let attempts = 0;
  const maxAttempts = 5;
  let data;

  while (attempts < maxAttempts) {
    const url = "http://127.0.0.1:9222/json/version";
    console.log("Fetching webSocket URL... " + url);

    try {
      const response = await axios.get(url);
      data = response.data;

      if (data) {
        break;
      }
    } catch (error) {
      console.error("error - " + JSON.stringify(error, null, 4));
    }

    attempts++;

    // Sleep for 5 seconds before the next attempt
    await sleep(5000);
  }

  return data.webSocketDebuggerUrl;
}

async function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), ms);
  });
}

(async () => {
  if (process.argv[2] === "isDev") {
    // const message = await openChatGpt();
    // console.log(message);
  }

  await openChrome();
  await openChatGpt();

  const port = process.platform === "linux" ? 6090 : 3000;

  app.listen(port, () => {
    console.log("Server Started");
  });
})();
