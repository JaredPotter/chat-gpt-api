import { cert, initializeApp } from "firebase-admin/app";
import { Settings, getFirestore } from "firebase-admin/firestore";

const serviceAccount = require("../chat-gpt-api-210d6-firebase-adminsdk-eeyap-cc9b9bdd38.json");

const app = initializeApp({
  // credential: applicationDefault(),
  credential: cert(serviceAccount),
});

const firestore = getFirestore(app);

// Maybe requried for applicationDefault()??
// const firestoreSettings: Settings = {
//   ignoreUndefinedProperties: true,
// };

// firestore.settings(firestoreSettings);

export default { firestore };
