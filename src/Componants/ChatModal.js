import React from 'react';
import './ChatModal.css';
import gql from 'graphql-tag';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { WebSocketLink } from "@apollo/client/link/ws";

import { DateTime } from 'luxon';   //신뢰할 만한 타임스탬프

import { useDispatch } from 'react-redux';
import { addNewAlertMessage } from '../redux/AlertMessageSlice';

import { ApolloClient, InMemoryCache, split, HttpLink } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';

const httpLink = new HttpLink({
  uri: 'http://localhost:4000/graphql', // GraphQL 서버 http endpoint
});

const wsLink = new WebSocketLink({
  uri: `ws://localhost:4000/graphql`,
  options: {
      reconnect: true
  }
});

const client = new ApolloClient({
  link: split(
    ({ query }) => {
      const definition = getMainDefinition(query);
      return (
        definition.kind === 'OperationDefinition' &&
        definition.operation === 'subscription'
      );
    },
    wsLink,
    httpLink
  ),
  cache: new InMemoryCache(),
});

const GET_MESSAGES = gql`
  query GetMessages($chatid: String!) {
    chatrooms(chatid: $chatid) {
      messages {
        senderEmail
        text
        sendAt
      }
    }
  }
`;

const SEND_MESSAGE = gql`
  mutation SendMessage($chatid: String!, $message: MessageInputType!) {
    addMessage(chatid: $chatid, message: $message) {
      senderEmail
      text
      sendAt
    }
  }
`;

const NEW_MESSAGE_SUBSCRIPTION = gql`
  subscription NewMessage($chatid: String!) {
    newMessage(chatid: $chatid) {
      senderEmail
      text
      sendAt
    }
  }
`;

export const ChatBubble = React.memo( function ChatBubble({ senderEmail, text, sendAt, isMine, isOwner }) {

  if (!senderEmail || !text || !sendAt ) {
    // 하나라도 값이 없으면 null 반환
    return null;
  }

  return (
    <div className={`chatBubble ${isMine ? 'right' : 'left'} ${isOwner ? 'owner' : ''}`}>
      <p>{senderEmail}</p>
      {isOwner && <span>마커 주인</span>}
      <div>{text}</div>
      <div className="timestamp">{sendAt}</div>
    </div>
  );
});

function ChatInput({ onSendMessage, currentemail }) {
  const [message, setMessage] = React.useState('');

  const handleSend = () => {
    if (message.trim()) {
      const now = DateTime.now();
      const currentTimestamp = now;
      onSendMessage({
        senderEmail: currentemail,
        text: message,
        sendAt: currentTimestamp
      });
      setMessage('');
    }
  };
  return (
    <div className="chatInput">
      <input value={message} onChange={e => setMessage(e.target.value)} placeholder="메시지를 입력하세요..." />
      <button onClick={handleSend}>Send</button>
    </div>
  );
}

const ChatModal = ({ isOpen, currentemail, markerOwnerEmail, onClose, chatid, roadAddress, jibunAddress }) => {

  const { data, loading, error } = useQuery(GET_MESSAGES, {
    variables: { chatid },
    fetchPolicy: "network-only" 
  });

  const [localMessages, setLocalMessages] = React.useState([]);
  React.useEffect(() => {
    setLocalMessages(data?.chatrooms[0]?.messages || []);
  }, [data]);

  const chatListRef = React.useRef(null);

  const scrollToBottom = () => {
    if (chatListRef.current) {
      chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
    }
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [localMessages]);

  const dispatch = useDispatch();

  const [sendMessage] = useMutation(SEND_MESSAGE, {
      onCompleted: (newMessageData) => {
        const newMessage = newMessageData.addMessage;

        // 메시지가 내 메시지가 아니면서 모든 값이 있을 경우 알림 메시지를 추가
        if (newMessage.senderEmail !== currentemail) {
          dispatch(addNewAlertMessage({
            senderEmail: newMessage.senderEmail,
            text: newMessage.text,
            sendAt: newMessage.sendAt,
            roadAddress,
            jibunAddress
          }));
        }
  
        setLocalMessages(prevMessages => {
          const isDuplicate = prevMessages.some(msg => msg.sendAt === newMessage.sendAt && msg.senderEmail === newMessage.senderEmail);
          if (isDuplicate) return prevMessages;  // 중복 메시지가 있다면 상태를 변경하지 않음
          return [...prevMessages, newMessage];
        });
      }
    });

  const { data: newMessageData } = useSubscription(NEW_MESSAGE_SUBSCRIPTION, { variables: { chatid } });
  if (error) {
      console.error("Subscription error:", error);
  }
  
  React.useEffect(() => {
    console.log("Received subscription data:", newMessageData); // 새로운 메시지 데이터를 로깅
    if (newMessageData?.newMessage) {
      const newMessage = newMessageData.newMessage;
      console.log('Successfully received a new message:', newMessage); // 새 메시지를 성공적으로 받았을 때 로깅
  
      setLocalMessages(prevMessages => {
        const isDuplicate = prevMessages.some(msg => msg.sendAt === newMessage.sendAt && msg.senderEmail === newMessage.senderEmail);
        if (isDuplicate) return prevMessages;
        return [...prevMessages, newMessage];
      });
    }
  }, [newMessageData]);
    
  const handleSendMessage = async (messageDetails) => {
    console.log({
      chatid: chatid,
      message: {
        senderEmail: messageDetails.senderEmail,
        text: messageDetails.text,
        sendAt: messageDetails.sendAt
      }
    });    
    try {
      await sendMessage({
        variables: {
          chatid: chatid,
          message: {
            senderEmail: messageDetails.senderEmail,
            text: messageDetails.text,
            sendAt: messageDetails.sendAt
          }
        }
      });
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  if (!isOpen) return null;
  if (loading) return <div>Loading...</div>;
  if (error) return <div>죄송합니다. 문제가 발생했습니다.</div>;

  // 날짜 형식화 함수
  function formatDate(currentTimestamp) {
    const date = new Date(currentTimestamp); 
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');        
    return `${year}-${month}-${day}, ${hours}:${minutes}:${seconds}`;
  }

  return (
    <div className="chat-modal">
      <p className='chat'>채팅</p>
      <div className="chat-list" ref={chatListRef}>
        {localMessages.map(message => {
          const isOwner = message.senderEmail === markerOwnerEmail;
          const isMine = message.senderEmail === currentemail;
          const formattedTime = formatDate(message.sendAt);
          return (
            <ChatBubble 
              key={`${message.senderEmail}-${message.sendAt}`} 
              senderEmail={message.senderEmail} 
              text={message.text}
              isMine={isMine} 
              isOwner={isOwner}
              sendAt={formattedTime}
              roadAddress={roadAddress}
              jibunAddress={jibunAddress}
            />
          );
        })}
      </div>
      <div className='chat-bottom'>
        <ChatInput 
          onSendMessage={handleSendMessage}
          currentemail={currentemail}
        />
        <button className='closebutton1' onClick={onClose}>닫기</button>
      </div>
    </div>
  );
}
  
export default ChatModal;
