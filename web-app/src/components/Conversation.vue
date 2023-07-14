<template>
  <div class="conversation-container">
    <div class="title">
      <div
        v-if="
          currentUser && conversation && conversation.to && conversation.to.name
        "
        class="to-name-title"
      >
        Messages with {{ conversation.to.name }}
      </div>
    </div>
    <div class="middle" :style="{ height: messageListHeight + 'px' }">
      <div class="scrollable">
        <div
          v-if="conversation.messages && conversation.messages.length > 0"
          class="message-list"
        >
          <div v-for="message of conversation.messages" class="message">
            <div
              class="message-row"
              :class="{
                'flex-start':
                  conversation.to.phone_number === message.from_phone_number,
                'flex-end':
                  currentUser.phone_number === message.from_phone_number,
              }"
            >
              <div
                class="message-box"
                :class="{
                  'flex-start':
                    conversation.to.phone_number === message.from_phone_number,
                  'flex-end':
                    currentUser.phone_number === message.from_phone_number,
                }"
              >
                <div
                  class="message-bubble"
                  :class="{
                    left:
                      conversation.to.phone_number ===
                      message.from_phone_number,
                    right:
                      currentUser.phone_number === message.from_phone_number,
                  }"
                >
                  {{ message.message }}
                </div>
                <div
                  :class="{
                    'date-time-right':
                      currentUser.phone_number === message.from_phone_number,
                  }"
                >
                  {{ formatUnixTime(message.unix) }}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else>No messages yet</div>
      </div>
    </div>
    <div class="bottom">
      <div class="chat-gpt">
        <label for="chatGptIsEnabledCheckbox" class="chat-gpt-label">
          <span>chatGPT Enabled:</span>
          <input
            type="checkbox"
            name="chatGptIsEnabledCheckbox"
            id="chatGptIsEnabledCheckbox"
            class="chat-gpt-checkbox"
            :checked="conversation.is_chat_gpt_enabled"
            @change="handleEnableChatGptClick"
          />
        </label>
      </div>
      <div class="textarea-and-button">
        <textarea
          v-model="messageToSend"
          @keyup.enter="handleSend"
          class="message-input"
          :disabled="conversation.is_chat_gpt_enabled"
        ></textarea>
        <button
          :disabled="!messageToSend"
          @click="handleSend"
          class="send-button"
        >
          🚀
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Options, Vue } from "vue-class-component";
import {
  addDoc,
  collection,
  serverTimestamp,
  setDoc,
  doc,
} from "firebase/firestore";
import FirebaseService from "../FirebaseService";
import dayjs from "dayjs";
import "dayjs/locale/en"; // Import the locale you want to use
import { watch } from "vue";

@Options({
  props: {
    conversation: Object,
    currentUser: Object,
  },
  data() {
    return {
      messageToSend: "",
      messageListHeight: 0,
    };
  },
  mounted() {
    const messagesList = document.querySelector(".scrollable");

    if (messagesList) {
      messagesList.scrollTop = messagesList.scrollHeight;
    }

    const titleElement = document.querySelector(".title") as HTMLElement;
    const bottomElement = document.querySelector(".bottom") as HTMLElement;
    this.messageListHeight =
      window.innerHeight -
      titleElement.clientHeight -
      bottomElement.clientHeight;

    window.addEventListener("resize", (event) => {
      this.messageListHeight =
        window.innerHeight -
        titleElement.clientHeight -
        bottomElement.clientHeight;
    });

    watch(
      () => this.conversation.messages,
      () => {
        this.$nextTick(() => {
          const messagesList = document.querySelector(".scrollable");
          if (messagesList) {
            messagesList.scrollTop = messagesList.scrollHeight;
          }
          this.messageListHeight =
            window.innerHeight -
            titleElement.clientHeight -
            bottomElement.clientHeight;
        });
      }
    );
  },
})
export default class Conversation extends Vue {
  messageToSend: string = "";
  conversation!: any;
  currentUser!: any;

  messageListHeight: number = 0;

  public async handleEnableChatGptClick(event: any) {
    this.conversation.is_chat_gpt_enabled = event.target.checked;
    await setDoc(
      doc(FirebaseService.firestore, "conversations", this.conversation.id),
      { is_chat_gpt_enabled: event.target.checked },
      { merge: true }
    );
  }

  public async handleSend() {
    if (this.messageToSend.length > 0) {
      const newMessage = {
        conversation_id: this.conversation.id,
        from_phone_number: this.currentUser.phone_number,
        from_name: this.currentUser.name,
        to_phone_number: this.conversation.to.phone_number,
        to_name: this.conversation.to.name,
        date_time: serverTimestamp(),
        unix: Date.now(),
        message: this.messageToSend,
      };

      await addDoc(
        collection(FirebaseService.firestore, "messages"),
        newMessage
      );

      await setDoc(
        doc(FirebaseService.firestore, "conversations", this.conversation.id),
        { last_active_at: serverTimestamp() },
        { merge: true }
      );

      this.messageToSend = "";
    }
  }

  public formatUnixTime(unixTime: number) {
    const date = dayjs.unix(unixTime / 1000);
    const formattedTime = date.format("h:mm A");
    const formattedDate = date.format("MMM D YYYY");

    return `${formattedTime} - ${formattedDate}`;
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.conversation-container {
  height: 100%;
}

.title {
  text-align: center;
}

.to-name-title {
  font-size: 2rem;
}

.middle {
}

.scrollable {
  overflow: auto;
  height: 100%;
}

.message-list {
  max-width: 7500px;
  border: 1px solid black;
  background-color: #1e1e1e;
}

.message {
  padding-top: 0.5rem;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
}

.message-row {
  display: flex;
  width: 100%;
}

.flex-start {
  justify-content: flex-start;
}

.flex-end {
  justify-content: flex-end;
}

.left {
  background-color: #3b3b3d;
  width: 100%;
}

.right {
  display: flex;
  background-color: #0a84ff;
}

.message-box {
  max-width: 80%;
  color: white;
  display: flex;
  flex-direction: column;
}

.message-bubble {
  border-radius: 10px;
  padding: 0.5rem;
}

.date-time-right {
  text-align: right;
}

.bottom {
  height: 90px;
}

.chat-gpt {
  padding: 0.4rem;
}

.chat-gpt-label {
  cursor: pointer;
  user-select: none; /* Standard syntax */
  -webkit-user-select: none; /* Safari 3.1+ */
  -moz-user-select: none; /* Firefox 2+ */
  -ms-user-select: none; /* IE 10+ */
}

.chat-gpt-label span {
  margin-right: 0.75rem;
}

.message-input {
  width: 80%;
  font-size: 1rem;
}

.textarea-and-button {
  display: flex;
  justify-content: space-evenly;
  align-items: center;
}

.textarea-and-button textarea:disabled {
  cursor: no-drop;
}

.send-button {
  font-size: 2rem;
  cursor: pointer;
  background: #65c466;
  border-radius: 10px;
}

.send-button:disabled {
  opacity: 0.5;
  cursor: no-drop;
}

.chat-gpt-checkbox {
  cursor: pointer;
  transform: scale(2); /* You can change the scale as you like */
  -ms-transform: scale(2); /* IE */
  -moz-transform: scale(2); /* Firefox */
  -webkit-transform: scale(2); /* Safari and Chrome */
  -o-transform: scale(2); /* Opera */
}
</style>
