import React from 'react';
import './ChatModal.css';
import { useQuery, useMutation } from '@apollo/client';
import gql from 'graphql-tag';

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

function ChatBubble({ message, isMine, isOwner, sendAt }) {
  return (
    <div className={`chatBubble ${isMine ? 'right' : 'left'} ${isOwner ? 'owner' : ''}`}>
      <p>{message.senderEmail}</p>
      {isOwner && <span>마커 주인</span>}
      <div>{message.text}</div>
      <div className="timestamp">{sendAt}</div>
    </div>
  );
}

function ChatInput({ onSendMessage, currentemail }) {
  const [message, setMessage] = React.useState('');

  const handleSend = () => {
    if (message.trim()) {
      const currentTimestamp = new Date().toISOString();
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

const ChatModal = ({ isOpen, currentemail, markerOwnerEmail, onClose, chatid }) => {

  const { data, loading, error } = useQuery(GET_MESSAGES, {
    variables: { chatid },
    fetchPolicy: "cache-and-network"
  });

  const [localMessages, setLocalMessages] = React.useState([]);
  React.useEffect(() => {
    setLocalMessages(data?.chatrooms[0]?.messages || []);
  }, [data]);

  const [sendMessage] = useMutation(SEND_MESSAGE, {
    onCompleted: (newMessageData) => {
      const newMessage = newMessageData.addMessage;
      setLocalMessages(prevMessages => [...prevMessages, newMessage]);
    }
  });

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
      <div className="chat-list">
        {localMessages.map(message => {
          const isOwner = message.senderEmail === markerOwnerEmail;
          const isMine = message.senderEmail === currentemail;
          const formattedTime = formatDate(message.sendAt);
          return (
            <ChatBubble 
              key={`${message.senderEmail}-${message.sendAt}`} 
              message={message} 
              isMine={isMine} 
              isOwner={isOwner} 
              sendAt={formattedTime}
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
