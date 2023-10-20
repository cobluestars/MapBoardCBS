const fs = require('fs');
const { ApolloServer, gql } = require('apollo-server');

const data = JSON.parse(fs.readFileSync('./db.json', 'utf-8'));

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

type Mutation {
  addMessage(chatid: String!, message: MessageInputType!): Message!
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
        addMessage: (_, { chatid, message }) => {
            return addMessageToDB(chatid, message);
        },
        createChatroom: (_, { input }) => {
            return createChatroomInDB(input.chatid);
        },
        deleteChatroom: (_, { chatid }) => {
            return deleteChatroomFromDB(chatid);
        }
    } 
};

const server = new ApolloServer({ typeDefs, resolvers });
server.listen().then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`);
});

//추후 db.json(json-server)와 apollo server간의 연동 해제하기