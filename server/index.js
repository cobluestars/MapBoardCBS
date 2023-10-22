const fs = require('fs');
const express = require('express');
const { gql } = require('apollo-server');
const cors = require('cors');

const { SubscriptionServer } = require('subscriptions-transport-ws');
const { execute, subscribe } = require('graphql');
const { makeExecutableSchema } = require('@graphql-tools/schema');

const ws = require('ws');
const http = require('http');
const { ApolloServer } = require('apollo-server-express');

const data = JSON.parse(fs.readFileSync('./db.json', 'utf-8'));
const { PubSub } = require('graphql-subscriptions');
const pubsub = new PubSub();

const NEW_MESSAGE = 'NEW_MESSAGE';

const createChatroomInDB = (chatid) => {
    // 채팅방이 이미 있는지 확인
    const existingChatroom = data.chatrooms.find(room => room.chatid === chatid);
    if (existingChatroom) {
        throw new Error(`Chatroom with id ${chatid} already exists.`);
    }

    // 새로운 채팅방 객체 생성
    const newChatroom = {
        chatid: chatid,
        currentemail: "",
        email: "",
        messages: []
    };

    // 새로운 채팅방을 데이터베이스에 추가
    data.chatrooms.push(newChatroom);
    fs.writeFileSync('./db.json', JSON.stringify(data, null, 2));
    return newChatroom;
};

const deleteChatroomFromDB = (chatid) => {
    //채팅방 존재 확인
    const index = data.chatrooms.findIndex(room => room.chatid === chatid);
    if (index === -1) {
        throw new Error(`Chatroom with id ${chatid} not found.`);
    }

    //채팅방 삭제
    const deletedChatroom = data.chatrooms.splice(index, 1)[0];
    fs.writeFileSync('./db.json', JSON.stringify(data, null, 2));
    return deletedChatroom;
};


const typeDefs = gql`
type Message {
    senderEmail: String!
    text: String!
    sendAt: String!
}

type Chatroom {
    chatid: String!
    currentemail: String!
    email: String!
    messages: [Message!]!
}

type Query {
    chatrooms(chatid: String): [Chatroom]
}

input MessageInputType {
  senderEmail: String!
  text: String!
  sendAt: String!
}

type Mutation {
    addMessage(chatid: String!, message: MessageInputType!): Message!
    createChatroom(input: CreateChatroomInput!): Chatroom!
    deleteChatroom(chatid: String!): Chatroom!
}

input CreateChatroomInput {
    chatid: String!
}

type Subscription {
    newMessage(chatid: String!): Message!
}
`;

const getChatroomsFromDB = () => {
    return data.chatrooms;
}

const addMessageToDB = (chatid, message) => {
  const chatroom = data.chatrooms.find(room => room.chatid === chatid);
  if (!chatroom) {
    throw new Error(`Chatroom with id ${chatid} not found.`);
  }
  chatroom.messages.push(message);
  fs.writeFileSync('./db.json', JSON.stringify(data, null, 2));
  return message;
};

const resolvers = {
    Query: {
        chatrooms: (_, { chatid }) => {
            const chatroomsData = getChatroomsFromDB();

            if (!chatroomsData) {
                throw new Error("Failed to fetch chatrooms data.");
            }

            if (chatid) {
                return chatroomsData.filter(chatroom => chatroom.chatid === chatid);
            }

            return chatroomsData;
        }
    },
    Mutation: {
        createChatroom: (_, { input }) => {
            return createChatroomInDB(input.chatid);
        },
        deleteChatroom: (_, { chatid }) => {
            return deleteChatroomFromDB(chatid);
        },
        addMessage: (_, { chatid, message }) => {
            const newMessage = addMessageToDB(chatid, message);
            const channel = `NEW_MESSAGE_${chatid}`;  // chatid별로 고유한 채널 이름 생성
            pubsub.publish(channel, { newMessage: newMessage, chatid: chatid });
            return newMessage;
        }
    },
    Subscription: {
        newMessage: {
            subscribe: (_, { chatid }) => {
                const channel = `NEW_MESSAGE_${chatid}`;  // chatid별로 고유한 채널 이름 생성
                return pubsub.asyncIterator([channel]);
            }
        }
    }
};

  const executableSchema = makeExecutableSchema({
    typeDefs,
    resolvers
  });

  const app = express();
  const corsOptions = {
    origin: ['http://localhost:3000','https://studio.apollographql.com'],  // 클라이언트 주소
    credentials: true
  };
  
  app.use(cors(corsOptions));
  
  const server = new ApolloServer({
    schema: executableSchema,
    subscriptions: {
      onConnect: () => console.log('Connected to websocket'),
    },
  });
    
  // Apollo Server 시작
  server.start().then(() => {
    server.applyMiddleware({ app });
  
    const httpServer = http.createServer(app);
  
    httpServer.listen({ port: 4000 }, () => {
      console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`);
      console.log(`🚀 Subscriptions ready at ws://localhost:4000/graphql`);
    });

    SubscriptionServer.create(
        {
            schema: executableSchema,
            execute,
            subscribe,
        },
        {
            server: httpServer,
            path: server.graphqlPath,
        }
    );
});
  
//추후 db.json(json-server)와 apollo server간의 연동 해제하기