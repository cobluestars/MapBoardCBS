import React from 'react';
import gql from 'graphql-tag';
import { useSubscription } from '@apollo/client';

import { useDispatch } from 'react-redux';
import { addMessageToAlert } from '../redux/AlertMessageSlice';

const NEW_MESSAGE_SUBSCRIPTION = gql`
  subscription NewMessage($chatid: String!) {
    newMessage(chatid: $chatid) {
      senderEmail
      text
      sendAt
    }
  }
`;

export const useNewMessageSubscription = (chatid, currentemail, roadAddress, jibunAddress) => {
    const dispatch = useDispatch();
    
    const [receivedMessages, setReceivedMessages] = React.useState([]); // 수신한 메시지의 상태
    
    const { data: newMessageData } = useSubscription(NEW_MESSAGE_SUBSCRIPTION, { variables: { chatid } });
  
    React.useEffect(() => {
      if (newMessageData?.newMessage) {
        const newMessage = newMessageData.newMessage;
        
        // 중복 메시지 체크
        const isDuplicate = receivedMessages.some(msg => 
          msg.sendAt === newMessage.sendAt && 
          msg.senderEmail === newMessage.senderEmail && 
          msg.text === newMessage.text);
  
        if (!isDuplicate) {
          // 중복 메시지가 아닌 경우만 상태를 업데이트
          setReceivedMessages(prevMessages => [...prevMessages, newMessage]);
        }
  
        // 메시지가 내 메시지가 아니면서 모든 값이 있을 경우 알림 메시지를 추가
        if (newMessage.senderEmail !== currentemail && !isDuplicate) {
          dispatch(addMessageToAlert({
            senderEmail: newMessage.senderEmail,
            text: newMessage.text,
            sendAt: newMessage.sendAt,
            roadAddress,
            jibunAddress,
            chatid
          }));
        }
      }
    }, [newMessageData, currentemail, chatid, dispatch, roadAddress, jibunAddress]);
  };
  