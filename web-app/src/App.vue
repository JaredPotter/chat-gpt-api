<template>
  <div class="app-container">
    <div class="conversation-list-container">
      <h3>Conversations</h3>
      <div>
        <div
          v-for="(conversation, index) in conversations"
          :key="conversation.id"
          class="conversation-list-item"
          :class="{
            'conversation-list-item-selected':
              index === selectedConversationIndex,
          }"
          @click="() => handleConversationSelect(index)"
        >
          <div v-if="conversation && conversation.to">
            {{ conversation.to.name }}
          </div>
          <div>
            {{ formatDate(conversation.last_active_at) }}
          </div>
        </div>
      </div>
    </div>
    <div class="conversation">
      <Conversation
        :conversation="selectedConversation"
        :currentUser="currentUser"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { Options, Vue } from "vue-class-component";
import Conversation from "./components/Conversation.vue";
import {
  query,
  where,
  collection,
  collectionGroup,
  getDocs,
  getDoc,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import dayjs from "dayjs";
import "dayjs/locale/en"; // Import the locale you want to use
import FirebaseService from "./FirebaseService";

@Options({
  components: {
    Conversation,
  },
  data() {
    return {
      selectedConversationIndex: -1,
      conversations: [],
      selectedConversation: {
        conversation_id: "",
        messages: [],
      },
    };
  },
  async mounted() {
    await this.fetchConversations();

    if (this.conversations.length > 0) {
      this.selectedConversationIndex = 0;
    }

    // const unsubscribeConversations = onSnapshot(
    //   query(
    //     collection(FirebaseService.firestore, "conversations"),
    //     orderBy("last_active_at", "desc")
    //   ),
    //   (snapshot) => {
    //     const conversations = snapshot.docs.map((doc) => doc.data());
    //     this.conversations = conversations;

    //     // for (const conversation of this.conversations) {
    //     //   const unsubscribeMessages = onSnapshot(
    //     //     query(
    //     //       collection(FirebaseService.firestore, "messages"),
    //     //       where("conversation_id", "==", conversation.id),
    //     //       orderBy("unix", "desc")
    //     //     ),
    //     //     (snapshot) => {
    //     //       // Reverse the messages so they appear correctly.
    //     //       const messages = snapshot.docs.map((doc) => doc.data()).reverse();
    //     //       conversation.messages = messages;
    //     //       conversation.to = this.getToContact(
    //     //         this.currentUser,
    //     //         conversation
    //     //       );
    //     //     }
    //     //   );
    //     // }
    //   }
    // );
  },
})
export default class App extends Vue {
  conversations: any[] = [];
  selectedConversationIndex = -1;
  selectedConversation: any = {
    conversation_id: "",
    messages: [],
  };
  // currently hard coded.
  currentUser = { phone_number: "+18775221772", name: "Twilio" };
  // currentUser = { phone_number: "+18015747900", name: "Jared Potter" };

  public fetchConversations = async () => {
    const peopleQuerySnapshot = await getDocs(
      query(
        collectionGroup(FirebaseService.firestore, "people"),
        where("phone_number", "==", this.currentUser.phone_number)
      )
    );

    if (
      peopleQuerySnapshot &&
      peopleQuerySnapshot.docs &&
      peopleQuerySnapshot.docs.length > 0
    ) {
      this.conversations = await Promise.all(
        peopleQuerySnapshot.docs.map(async (doc) => {
          const conversationRef = doc.ref.parent.parent;
          const conversationSnapshot = await getDoc(conversationRef!);

          if (conversationRef && conversationSnapshot.exists()) {
            const conversationData = conversationSnapshot.data();
            conversationData.id = conversationSnapshot.id;

            // Get people
            const peopleSubCollectionRef = collection(
              conversationRef,
              "people"
            );
            const peopleSubScollectionSnapshot = await getDocs(
              peopleSubCollectionRef
            );

            conversationData.people = peopleSubScollectionSnapshot.docs.map(
              (doc) => {
                const personData = doc.data();
                personData.id = doc.id;
                return personData;
              }
            );

            return conversationData;
          }
        })
      );

      this.conversations = this.conversations.sort((a, b) => {
        const timestampA = a.last_active_at.toDate();
        const timestampB = b.last_active_at.toDate();
        return timestampB - timestampA;
      });
    }

    for (const conversation of this.conversations) {
      const unsubscribe = onSnapshot(
        query(
          collection(FirebaseService.firestore, "messages"),
          where("conversation_id", "==", conversation.id),
          orderBy("unix", "desc")
        ),
        (snapshot) => {
          // Reverse the messages so they appear correctly.
          const messages = snapshot.docs.map((doc) => doc.data()).reverse();
          conversation.messages = messages;
          conversation.to = this.getToContact(this.currentUser, conversation);
        }
      );
    }

    if (this.conversations.length > 0) {
      this.selectedConversationIndex = 0;
      const conversation = this.conversations[0];
      const messageSnapshot = await getDocs(
        query(
          collection(FirebaseService.firestore, "messages"),
          where("conversation_id", "==", conversation.id),
          orderBy("unix", "desc")
        )
      );
      // Reverse the messages so they appear correctly.
      const conversationMessages = messageSnapshot.docs
        .map((doc) => doc.data())
        .reverse();
      conversation.messages = conversationMessages;
      conversation.to = this.getToContact(this.currentUser, conversation);
      this.selectedConversation = conversation;
    }
  };

  public getToContact(currentUser: any, conversation: any) {
    for (const person of conversation.people) {
      if (currentUser.phone_number !== person.phone_number) {
        return person;
      }
    }
  }

  public formatDate(firestoreTimestamp: any) {
    const string = dayjs(firestoreTimestamp.toDate()).format("MMM DD HH:mm");

    return string;
  }

  public handleConversationSelect(index: number) {
    this.selectedConversationIndex = index;
    this.selectedConversation =
      this.conversations[this.selectedConversationIndex];
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.app-container {
  display: flex;
}

.conversation-list-container {
  width: 30%;
  border-right: 1px solid black;
  width: 100%;
}

.conversation-list-item {
  border: 1px solid black;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  padding: 0.25rem;
}

.conversation {
  width: 100%;
  height: 100%;
}

.conversation-list-item-selected {
  border: 1px solid black;
  background-color: rgb(69 153 223);
  color: white;
}

@media (max-width: 500px) {
  .conversation-list-container {
    display: none;
  }

  .content {
    width: 100%;
  }
}
</style>
