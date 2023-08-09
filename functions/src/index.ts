import { onRequest } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

require('dotenv').config();
const twilio = require('twilio');
const axios = require('axios');
import FirebaseService from './FirebaseService';
import ChatGptService from './ChatGptService';
import HouseCleaningServiceRequest from './models/HouseCleaningServiceRequest';
import ServiceType from './enums/ServiceType';
import BaseServiceRequest from './models/BaseServiceRequest';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER
  ? process.env.TWILIO_PHONE_NUMBER
  : '';
const twilioAdminPhoneNumber = process.env.TWILIO_ADMIN_PHONE_NUMBER
  ? process.env.TWILIO_ADMIN_PHONE_NUMBER
  : '';
const client = twilio(accountSid, authToken);
const ADMIN_NAME = process.env.ADMIN_NAME;

// Firebase Functions Exports
// exports.accountcleanup = onSchedule("every day 00:00", async (event) => {
exports.keepSessionActive = onSchedule('every minute', keepSessionActive);
exports.handleCustomerSms = onRequest(handleCustomerSms);
exports.handleNewMessageCreated = onDocumentCreated(
  'messages/{docId}',
  handleNewMessageCreated
);
exports.dev = onRequest(async (request, response) => {
  console.log('dev() function called');
  //   let existingCustomerServiceRequests = await FirebaseService.getDocs(
  //     "service_requests",
  //     [
  //       {
  //         field: "customer_person_id",
  //         operator: "==",
  //         value: "aN6aHcjcI2f4I6Lj1q4b",
  //       },

  //       {
  //         field: "created_at_unix",
  //         operator: ">=",
  //         value: Date.now() - 1814400000, // 3 weeks
  //       },
  //     ]
  //   );
  //   existingCustomerServiceRequests = existingCustomerServiceRequests.filter(
  //     (item) => item.completed_at_unix === null
  //   );

  const recentMessages = await FirebaseService.getDocs(
    'messages',
    [
      {
        field: 'id',
        operator: '==',
        value: '13FvGLGcF9lBngquQ8it',
      },
    ],
    { field: 'created_at_unix', direction: 'asc' }
  );

  response.send(recentMessages);
  return;
  await handleHouseCleaningRequest(
    'aN6aHcjcI2f4I6Lj1q4b',
    "I'm interested in a house cleaning and yard work. Especially the bathroom.",
    [],
    {
      id: '13FvGLGcF9lBngquQ8it', // customer id
    },
    '+18015747900',
    'Jared Potter'
  );

  response.send('GOOD');
});

async function handleCustomerSms(request: any, response: any) {
  const fromPhoneNumber = request.body.From;
  const toPhoneNumber = request.body.To;
  const message = request.body.Body;

  // Lookup conversation
  const peopleRef = FirebaseService.firestore.collectionGroup('people');
  const toPersonSnapshot = await peopleRef
    .where('phone_number', '==', toPhoneNumber)
    .get();
  const fromPersonSnapshot = await peopleRef
    .where('phone_number', '==', fromPhoneNumber)
    .get();

  let conversation;

  let toPersonDocSnapshot: any;
  let fromPersonDocSnapshot: any;

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
    response.send({ error: 'conversation not found' });
    return;
  }

  const newMessage = {
    conversation_id: conversation.id,
    from_phone_number: fromPhoneNumber,
    from_name: fromPersonDocSnapshot?.data().name,
    to_phone_number: toPhoneNumber,
    to_name: toPersonDocSnapshot?.data().name,
    message: message,
  };

  const now = Date.now();

  await FirebaseService.addDoc('messages', newMessage);

  if (conversation.is_chat_gpt_enabled) {
    // pull in latest sorted messages from customer.
    const recentMessages = await getRecentMessages(conversation.id, 20);
    const recentMessagesFormatted = recentMessages
      .map((message) => {
        return JSON.stringify({
          from_name: message.from_name,
          to_name: message.to_name,
          message: message.message,
          created_at_unix: message.created_at_unix,
          context: message.context ? message.context : null,
        });
      })
      .join('\n');

    let query = `
    I'm the owner of a concierge business and I received the following message from a customer: "${message}"\n
    I need help determining if this message is a new service request or about an existing service request.
    For reference the current time is ${now}.
    For context I've attached the following recent text messages: ${recentMessagesFormatted}.\n
    The recent messages have a "created_at_unix" time to know the order they were sent.
    My messages have the "from_name" field of "${ADMIN_NAME}".\n
    The customer's messages are the "from_name" that is not "${ADMIN_NAME}".\n    
    Here's some rules to help you determine if this is a new service request or an existing service request.
    If there are many recent messages within the last 20 minutes then it is likely an existing service request.
    If my 1-4 most recent messages contain a "context" field then it is also likely to be an existing service request.
    If there are no recent messages in the last 20 minutes and none of my last 4 recent messages have a "context" field or the "context" is null then this
    is most likely a new service request.
    
    The 'message' field is the contents of the text.
    Result should be a json code block with a field named is_new_request and set to true if the message is a new service request or false if the 
    message is an existing service request.. 
    If you are uncertain if it should be true or false also include in the json a is_certain true/false field. 
    Also include a 'reasoning' field. No explanation necessary.
    Double check that the json is valid.
    `;

    const isANewOrExistingRequestResponse = await ChatGptService.queryChatGpt(
      query
    );

    if (
      isANewOrExistingRequestResponse.is_new_request &&
      isANewOrExistingRequestResponse.is_certain
    ) {
      console.log('IS NEW SERVICES REQUEST');
      query = `
        I'm the owner of a concierge business and I received the following message from a customer: "${message}"\n
        I need help determining which services the customer is interested in. Services to specifically look for: 
        "house cleaning", "yard work", "pool maintenance", "ski tuning repain", "bike tuning repair", "car detailing", "window washing", 
        "dog waste clean up", "window washing", and "general erreands". Do not include window washing unless explictly mentioned.
        For reference the current time is ${now}.
        For context I've attached the following recent text messages: ${recentMessagesFormatted}.\n
        For reference my messages have a "from_name" with a value of ${ADMIN_NAME}. The other "from_name" values are the customer.
        The json would be an object that contains a property of 'services' and the value is an array 
        of strings that match one of the services above; if there's a space character, replace it with an underscore. If the messages say explictly when the customer would like the service done then include a 'due_date' field. 
        Include a 'special_details' field if there's something specific the customer wants us to know. Please show me the output in a code block formatted 
        and copiable.  No explanation necessary.
        Double check that the json is valid.
        `;

      /*
            "services": [
                "house cleaning",
                "car detailing",
                "dog waste cleanup"
            ],
            "due_date": "2023-11-23",
            "special_details": ""
        */
      const newRequestServicesResponse = await ChatGptService.queryChatGpt(
        query
      );

      const specialDetails = newRequestServicesResponse.special_details
        ? newRequestServicesResponse.special_details
        : null;

      if (
        newRequestServicesResponse &&
        newRequestServicesResponse.services.length > 0
      ) {
        let servicesListString = newRequestServicesResponse.services.join(', ');
        servicesListString = servicesListString.slice(
          0,
          servicesListString.length
        );
        query = `
            Help me write a short response to this customer of my concierge business. Tell the customer
            some positive confirming message about the services. The services to include are ${newRequestServicesResponse.services}.
            In the actual message do not include the underscores. Also make the message tone 90% casual and 10% professional. 
            The message should only only be approximate 30 words.
            The result should be in a json code block. 
            A field called 'message_to_customer' should have the value of the composed message. No explaination necessary.
            Double check that the json is valid.
        `;
        const customerServiceRequestConfirmationResponse =
          await ChatGptService.queryChatGpt(query);

        /**
         * EXAMPLE RESPONSE
         * Sure thing! We've got you covered for house cleaning and yard work, including the bathroom.
         * Our team will take care of everything. Thank you for choosing our services!
         */

        const newMessageForCustomer =
          customerServiceRequestConfirmationResponse.message_to_customer;
        const fromName = fromPersonDocSnapshot?.data().name; // white cloud admin
        const toName = toPersonDocSnapshot?.data().name;

        const newMessage = {
          conversation_id: conversation.id,
          from_phone_number: twilioPhoneNumber,
          from_name: toName, // admin
          to_phone_number: fromPhoneNumber,
          to_name: fromName, // customer
          message: newMessageForCustomer,
        };

        FirebaseService.addDoc('messages', newMessage);
        sendMessage(
          newMessageForCustomer,
          fromPhoneNumber, // send to customer
          twilioPhoneNumber!
        );

        const customerId = fromPersonDocSnapshot!.id;

        for (const service of newRequestServicesResponse.services) {
          console.log('service ' + service);

          if (service === 'house_cleaning') {
            await handleHouseCleaningRequest(
              customerId,
              message,
              recentMessages,
              conversation,
              fromPhoneNumber,
              fromName
            );
          }
        }
      }
    } else {
      // An existing request.
      console.log('IS EXISTING SERVICE REQUEST');

      const query = `
      I'm the owner of a concierge business and I received the following message from a customer: "${message}"\n
      I need help determining if the new message contains the response to my most recent message or not. \n
      Here's a list of my most recent messages:${recentMessagesFormatted}.\n 
      To know which was the most recent message look at the object's created_at_unix field and for reference the time now in unix is ${Date.now()}.\n
      To better determine which messages I sent vs my customer; my messages have a "from_name" field with the value of "${ADMIN_NAME}".
      On my most recent messages look for a "context" field that contains an object with a "service_request_id", a "field", and a "example_responses" array.
      Also on my most recent message is a set of "special_instructions" that should be applied to this request.

      Inspect the "examples_responses" and look at the "customer_response" values and determine if they match the customers message: "${message}"\n
      
      Return a JSON object code block. Any parts in the json example surrounded by <> should be replaced by real values.
      {
        "service_request_id": "<the service_request_id from context.service_request.id>",
        fields: {
            "<field>": "<based on the 'value' mentioned in 'special_instructions' if set>",
        }
        reasoning: "<any specific reasoning as to the decisions of this result json>",
        is_certain: "<true if you're very certain about the results or false if you are uncertain about the results>"
      }\n

      The <field> value should be set according to these rules.
      If the context.field string does NOT contain a period "." then set <field> to the "context.field" value.
      If the context.field strind does contain a . period "." such as "cleaning_details.number_of_bedrooms" then create a json
      object {
        cleaning_details: { number_of_bedrooms: 4 }
      }.
      Double check that the json is valid.
      `;

      const chatGptResponse = await ChatGptService.queryChatGpt(query);

      if (chatGptResponse.service_request_id) {
        let serviceRequest = await FirebaseService.getDoc(
          'service_requests',
          chatGptResponse.service_request_id
        );

        if (serviceRequest) {
          const fields: any = {};

          for (const path of Object.keys(chatGptResponse.fields)) {
            const value = chatGptResponse.fields[path];
            const pathParts = path.split('.');
            const result: any = {};
            let currentPart = result;

            for (let i = 0; i < pathParts.length; i++) {
              const part = pathParts[i];

              if (i === pathParts.length - 1) {
                currentPart[part] = value;
              } else {
                currentPart[part] = {};
                currentPart = currentPart[part];
              }
            }

            fields[Object.keys(result)[0]] = result[Object.keys(result)[0]];
          }

          serviceRequest = {
            ...serviceRequest,
            ...fields,
          };

          await FirebaseService.updateDoc(
            'service_requests',
            serviceRequest,
            true
          );
        }
        serviceRequest = await FirebaseService.getDoc(
          'service_requests',
          serviceRequest!.id
        );

        console.log('here: ' + JSON.stringify(serviceRequest, null, 4));
        if (
          serviceRequest &&
          serviceRequest.service_type === 'house_cleaning'
        ) {
          let houseCleaningServiceRequest = new HouseCleaningServiceRequest(
            serviceRequest
          );
          const nextQuestion =
            await houseCleaningServiceRequest.getNextCustomerQuestionMessage();

          if (nextQuestion.next_customer_question) {
            const newMessage = {
              conversation_id: conversation.id,
              from_phone_number: twilioPhoneNumber,
              from_name: ADMIN_NAME,
              to_phone_number: fromPhoneNumber,
              to_name: fromPersonDocSnapshot?.data().name,
              message: nextQuestion.next_customer_question,
              context: nextQuestion.context,
            };

            await FirebaseService.addDoc('messages', newMessage);
          }
        }
      }
    }

    //   Additionally the data points need to match specific service requests which are defined in json here: ${serviceRequestsFormatted}\n
    //   For reference the current time is ${Date.now()}.\n
  }

  response.send();
  console.log('END - handleCustomerSms()');
}

async function handleHouseCleaningRequest(
  customerId: string,
  message: string,
  recentMessages: any[],
  conversation: any,
  customerPhoneNumber: string,
  customerName: string,
  existingServiceRequest: HouseCleaningServiceRequest | null = null
) {
  console.log('START - handleHouseCleaningRequest()');

  let houseCleaningServiceRequest = new HouseCleaningServiceRequest();

  if (existingServiceRequest) {
    // existing request.
    houseCleaningServiceRequest = new HouseCleaningServiceRequest(
      existingServiceRequest
    );

    // TODO: how do the other fields get set here?
  } else {
    // new request.
    const newDoc = await FirebaseService.firestore
      .collection('service_requests')
      .add({});

    houseCleaningServiceRequest.id = newDoc.id;

    await FirebaseService.updateDoc(
      'service_requests',
      houseCleaningServiceRequest.toFirestore(),
      true
    );
  }

  const nextCustomerQuestionResponse =
    await houseCleaningServiceRequest.getNextCustomerQuestionMessage();

  const newMessage = {
    conversation_id: conversation.id,
    from_phone_number: twilioPhoneNumber,
    from_name: ADMIN_NAME,
    to_phone_number: customerPhoneNumber,
    to_name: customerName,
    message: nextCustomerQuestionResponse.next_customer_question,
    context: nextCustomerQuestionResponse.context,
  };

  // wait 10 seconds before sending next message
  await new Promise((resolve) => setTimeout(resolve, 10000));

  await FirebaseService.addDoc('messages', newMessage);

  sendMessage(
    nextCustomerQuestionResponse.next_customer_question,
    customerPhoneNumber,
    twilioPhoneNumber
  );

  houseCleaningServiceRequest.is_waiting_for_customer_response = true;
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
    .collection('messages')
    .where('conversation_id', '==', conversationId)
    .orderBy('created_at_unix', 'desc')
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
    // const response = await client.messages.create({
    //   body: message,
    //   from: from,
    //   to: to,
    // });
  } catch (error) {
    console.error(error);
  }
}

async function keepSessionActive(event: any) {
  const url = process.env.KEEP_SESSION_ACTIVE_URL;

  try {
    const response = await axios.post(url, {
      query:
        "I want a json code block that contains the field names of 'ep_1' through 'ep_6' and the values the year the first 6 star wars movies were released in a number format. No explantion.",
    });

    console.log(JSON.stringify(response.data), null, 4);
  } catch (error) {
    const response = await client.messages.create({
      body: 'Keep alive session alive failed',
      from: twilioPhoneNumber,
      to: twilioAdminPhoneNumber,
    });
  }
}

(() => {
  //   console.log("Hello, world!");
})();
