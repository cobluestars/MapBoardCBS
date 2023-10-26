import React from 'react';
import './ChatModal.css';
import gql from 'graphql-tag';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { WebSocketLink } from "@apollo/client/link/ws";

import { DateTime } from 'luxon';   //신뢰할 만한 타임스탬프

import { useDispatch } from 'react-redux';
import { setChatId, setCurrentemail, setRoadAddress, setJibunAddress } from '../redux/ChatSlice';

import { ApolloClient, InMemoryCache, split, HttpLink } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';

import { getAuth } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';

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

const ChatModal = ({ isOpen, markerOwnerEmail, onClose, chatid, roadAddress, jibunAddress }) => {

  /* currentemail prop가 자꾸 받아지다 안 받아지다 해서 짜증나서 그냥 갖다 붙일 거다. */
  // user 상태와 setUser 함수 정의
  const auth = getAuth();

  const [user, setUser] = React.useState(null);

  // Redux를 위한 dispatch 함수를 가져옴
  const dispatch = useDispatch();

  React.useEffect(() => {
    // 인증 상태가 변경될 때마다...
    const unsubscribe = onAuthStateChanged(auth, currentUser => {
        if (currentUser) {
            setUser({
                email: currentUser.email,
                uid: currentUser.uid,
            });
            // Redux store에 현재 유저의 이메일을 업데이트
            dispatch(setCurrentemail(currentUser.email));
        } else {
            setUser(null);
            // 로그아웃 상태일 때 Redux store의 이메일을 초기화
            dispatch(setCurrentemail(null));
        }
    });
    // effect 종료 시, 구독을 취소
    return () => unsubscribe();
  }, [auth, dispatch]);

  if (user) {
    console.log(user.email);
  } else {
    console.log('Logout')
  };
  /* 말리지 마 */

  // prop으로 받은 값들을 Redux store에 저장
  React.useEffect(() => {
    dispatch(setChatId(chatid));
    dispatch(setRoadAddress(roadAddress));
    dispatch(setJibunAddress(jibunAddress));
  }, [chatid, roadAddress, jibunAddress, dispatch]);

  const { data, loading, error } = useQuery(GET_MESSAGES, {
    variables: { chatid },
    fetchPolicy: "network-only" 
  });

  const [localMessages, setLocalMessages] = React.useState([]);
  const [newMessages, setNewMessages] = React.useState([]);

  React.useEffect(() => {
    // ChatModal 컴포넌트가 마운트될 때, 초기 메시지 목록을 가져옴
    const initialMessages = data?.chatrooms[0]?.messages || [];
    setLocalMessages(initialMessages);
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

  const [sendMessage] = useMutation(SEND_MESSAGE, {
    onCompleted: (newMessageData) => {
      const newMessage = newMessageData.addMessage;
  
      setLocalMessages(prevMessages => {
        const isDuplicate = prevMessages.some(msg => msg.sendAt === newMessage.sendAt && msg.senderEmail === newMessage.senderEmail);
        if (isDuplicate) return prevMessages;  // 중복 메시지가 있다면 상태를 변경하지 않음
        const updatedMessages = [...prevMessages, newMessage];
        console.log('Updated local messages:', updatedMessages);
        return updatedMessages;
      });
    },
    onError: (error) => {
      console.error('Error sending message:', error);
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
  
      // localMessages에 메시지 추가
      setLocalMessages(prevMessages => {
        const isDuplicate = prevMessages.some(msg => 
          msg.sendAt === newMessage.sendAt && 
          msg.senderEmail === newMessage.senderEmail && 
          msg.text === newMessage.text);
        if (isDuplicate) return prevMessages;
        return [...prevMessages, newMessage];
      });
    }
  }, [newMessageData]);
    
  const handleSendMessage = async (messageDetails) => {    
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
          const isMine = message.senderEmail === user.email;
          const formattedTime = formatDate(message.sendAt);
          return (
            <ChatBubble 
              key={`${message.senderEmail}-${message.sendAt}`}
              chatid={chatid} 
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
          currentemail={user && user.email}
        />
        <button className='closebutton1' onClick={onClose}>닫기</button>
      </div>
    </div>
  );
}
  
export default ChatModal;
