import { onRequest } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { FieldValue } from "firebase-admin/firestore";

require("dotenv").config();
const twilio = require("twilio");
import FirebaseService from "./FirebaseService";
import ChatGptService from "./ChatGptService";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const client = twilio(accountSid, authToken);

// Firebase Functions Exports
exports.handleCustomerSms = onRequest(handleCustomerSms);
exports.handleNewMessageCreated = onDocumentCreated(
  "messages/{docId}",
  handleNewMessageCreated
);

async function handleCustomerSms(request: any, response: any) {
  const fromPhoneNumber = request.body.From;
  const toPhoneNumber = request.body.To;
  const message = request.body.Body;

  // Lookup conversation
  const peopleRef = FirebaseService.firestore.collectionGroup("people");
  const toPersonSnapshot = await peopleRef
    .where("phone_number", "==", toPhoneNumber)
    .get();
  const fromPersonSnapshot = await peopleRef
    .where("phone_number", "==", fromPhoneNumber)
    .get();

  let conversation;

  let toPersonDocSnapshot;
  let fromPersonDocSnapshot;

  if (
    toPersonSnapshot &&
    toPersonSnapshot.docs &&
    toPersonSnapshot.docs.length > 0
  ) {
    toPersonDocSnapshot = toPersonSnapshot.docs[0];
  }

  if (
    fromPersonSnapshot &&
    fromPersonSnapshot.docs &&
    fromPersonSnapshot.docs.length > 0
  ) {
    fromPersonDocSnapshot = fromPersonSnapshot.docs[0];
  }

  const conversationRef = toPersonDocSnapshot?.ref.parent.parent;

  if (conversationRef) {
    const conversationSnapshot = await conversationRef.get();
    const conversationData: any = conversationSnapshot.data();
    conversationData.id = conversationSnapshot.id;
    conversation = conversationData;
  }

  if (!conversation) {
    response.send({ error: "conversation not found" });
    return;
  }

  const newMessage = {
    conversation_id: conversation.id,
    from_phone_number: fromPhoneNumber,
    from_name: fromPersonDocSnapshot?.data().name,
    to_phone_number: toPhoneNumber,
    to_name: toPersonDocSnapshot?.data().name,
    date_time: FieldValue.serverTimestamp(),
    unix: Date.now(),
    message: message,
  };

  const newDoc = await FirebaseService.firestore
    .collection("messages")
    .add(newMessage);
  const newMessageData = (await newDoc.get()).data();

  // If chatGPT is enabled - generate response now.
  // TODO - pull in latest sorted messages from customer
  // determine what action / flow to take.
  const recentMessages = await getRecentMessages(conversation.id, 20);
  const recentMessagesFormatted = recentMessages
    .map((message) => {
      return JSON.stringify({
        from_name: message.from_name,
        message: message.message,
        unix: message.unix,
      });
    })
    .join("\n");

  const query = `
    I'm the owner of a concierge business and I received the following message from a customer: "${message}"\n
    I need help determining if this message is a new service request or about an existing service request. 
    For reference I've attached the following recent text messages: ${recentMessagesFormatted}.\n
    The 'from_name' that contains 'twilio' is representing the concierge business and other 'from_name' should be the customer.
    The 'unix' field is the time of the message. The 'message' field is the contents of the text.
    Result should be a json code block with a field named is_new_request and true/false. 
    If you are uncertain if it should be true or false also include in the json a is_certain true/false field. 
    If is_certain is true then also include a 'reason' field. No explanation.
    `;

  const isANewOrExistingRequestResponse = await ChatGptService.queryChatGpt(
    query
  );

  //   query = query + ""

  response.send(isANewOrExistingRequestResponse);
  // response.send(newMessageData);
}

async function handleNewMessageCreated(event: any) {
  const message = event.data.data();

  // If coming from Twilio Business Phone Number
  if (message.from_phone_number === twilioPhoneNumber) {
    try {
      await sendMessage(
        message.message,
        message.to_phone_number,
        message.from_phone_number
      );
    } catch (error) {
      console.error(JSON.stringify(error, null, 4));
    }
  }
}

async function getRecentMessages(conversationId: string, count: number) {
  const messageQuerySnapshot = await FirebaseService.firestore
    .collection("messages")
    .where("conversation_id", "==", conversationId)
    .orderBy("unix", "desc")
    .limit(count)
    .get();

  const recentMessages = messageQuerySnapshot.docs.map((doc) => {
    const message = doc.data();
    message.id = doc.id;

    return message;
  });

  return recentMessages.reverse();
}

async function sendMessage(message: string, to: string, from: string) {
  try {
    const response = await client.messages.create({
      body: message,
      from: from,
      to: to,
    });
  } catch (error) {
    console.error(error);
  }
}

(() => {
  //   console.log("Hello, world!");
})();
