import { cert, initializeApp } from "firebase-admin/app";
import {
  FieldValue,
  OrderByDirection,
  Settings,
  WhereFilterOp,
  getFirestore,
} from "firebase-admin/firestore";

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

async function getDocs(
  collection: string,
  conditions:
    | { field: string; operator: WhereFilterOp; value: any }[]
    | null = null,
  orderBy: {
    field: string;
    direction: string;
  } | null = null,
  count: number = -1
) {
  const collectionRef = firestore.collection(collection);
  let query;

  if (conditions && conditions.length > 0) {
    query = collectionRef;

    for (const condition of conditions) {
      query = query.where(condition.field, condition.operator, condition.value);
    }
  }

  if (query && orderBy) {
    query = query.orderBy(orderBy.field, orderBy.direction as OrderByDirection);
  }

  if (query && count > 0) {
    query = query.limit(count);
  }

  let snapshot;

  if (!query) {
    snapshot = await collectionRef.get();
  } else {
    snapshot = await query.get();
  }

  const documents = snapshot.docs.map((doc) => {
    const document = doc.data();
    document.id = doc.id;

    return document;
  });

  return documents;
}

async function getDoc(collection: string, id: string) {
  const docSnapshot = await firestore.collection(collection).doc(id).get();
  const document = docSnapshot.data();
  document!.id = docSnapshot.id;
  return document;
}

async function addDoc(collection: string, document: any) {
  document.created_at_unix = Date.now();
  document.created_at_date_time = FieldValue.serverTimestamp();

  return await firestore.collection(collection).add(document);
}

async function updateDoc(
  collection: string,
  document: any,
  merge: boolean = false
) {
  document.updated_at_unix = Date.now();
  document.updated_at_date_time = FieldValue.serverTimestamp();

  return await firestore.collection(collection).doc(document.id).set(document, {
    merge,
  });
}

export default { firestore, getDoc, getDocs, addDoc, updateDoc };
