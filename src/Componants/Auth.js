import React, { useState, useEffect } from 'react';
import { auth, reauthenticateWithCredential, EmailAuthProvider, updateEmail, updatePassword, deleteUser } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { db } from './firebase';
import { collection, doc, setDoc, getDoc } from 'firebase/firestore';
import './Auth.css'
import AlertMessageList from './AlertMessageList';

import { useSelector, useDispatch } from 'react-redux';
import { resetMessageCount } from '../redux/AlertMessageSlice';

function Auth() {
    // 회원가입/로그인/로그아웃
    const [user, setUser] = useState(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const [showModal, setShowModal] = useState(false); // 모달 창 보여주기/숨기기
    const [contact, setContact] = useState('');  // 연락처
    const [address, setAddress] = useState('');  // 주소

    const [isMessageListOpen, setMessageListOpen] = useState(false);
    const AlertValue = useSelector(state => state.AlertMessage.value);
    const AlertMessages = useSelector(state => state.AlertMessage.messages);
    
    const dispatch = useDispatch();
    
    const handleAlertMessageClick = () => {
        handleReset(); // 클릭 시 메시지 카운트를 리셋
        setMessageListOpen(true);
    }

    const handleCloseModal = () => {
        setMessageListOpen(false);
    }
    
    const handleReset = () => {     //알림 메세지 리셋
      dispatch(resetMessageCount());
    };
    
    // 회원가입 함수
    const signUp = async () => {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const { user } = userCredential;
            await saveContactAndAddressToDatabase(user.uid, contact, address); // 회원가입 시 연락처와 주소 저장
            alert("회원가입 성공!");
        } catch (error) {
            alert(error.message);
        }
    };
    // 로그인 함수
    const signIn = async () => {
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            alert(error.message);
        }
    };

    // 로그아웃 함수
    const signOutUser = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            alert(error.message);
        }
    };

    const updateUserDetails = async () => {
        // 연락처 및 주소 변경 로직
        if (user) {
            await saveContactAndAddressToDatabase(user.uid, contact, address);
            alert("정보가 수정되었습니다.");
        }
    };    

    const deleteUserAccount = async () => {
        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await deleteUser(auth.currentUser);
        alert("계정이 삭제되었습니다.");
    }

    // 사용자 정보 가져오기
    const fetchUserInfoFromDatabase = async (userId) => {
        const userDoc = doc(db, 'users', userId); // 'users' 컬렉션 사용
        const userSnap = await getDoc(userDoc);

        if (userSnap.exists()) {
            return userSnap.data();
        } else {
            return null; // 해당 사용자의 정보가 Firestore에 없으면 null 반환
        }
    }

    // 사용자 정보 저장하기
    const saveContactAndAddressToDatabase = async (userId, contact, address) => {
        const userDoc = doc(db, 'users', userId); // 'users' 컬렉션 사용
        await setDoc(userDoc, {
            userId,
            contact,
            address
        }, { merge: true }); // merge: true는 기존 데이터를 덮어쓰지 않게 함
    }

    // 사용자 상태 변경 감지
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async user => {
            setUser(user);
            if (user) {
                const userInfo = await fetchUserInfoFromDatabase(user.uid);
                if (userInfo) {
                    setContact(userInfo.contact || '');  // 데이터베이스에 정보가 없으면 빈 문자열로 설정
                    setAddress(userInfo.address || '');
                }
            }
        });
        return () => unsubscribe(); // 컴포넌트 unmount 시 unsubscribe
    }, []);
    
    return (
        <div className="auth-wrap">
            {user ? (
                <>
                    <span>Logged in as {user.email}</span>
                    <button onClick={signOutUser}>로그아웃</button>
                    <button onClick={() => setShowModal(true)}>회원정보</button>
                        {AlertValue && 
                            <p className='AlertValue' onClick={handleReset}>
                            {AlertValue}
                            </p>
                        }
                        {isMessageListOpen && (
                            <div className="modalBackdrop" onClick={handleCloseModal}>
                                {/* 클릭 이벤트가 이 div로 전파되지 않도록 함 */}
                                <div onClick={e => e.stopPropagation()}>
                                    <AlertMessageList 
                                        messages={AlertMessages ? AlertMessages.messages : []} 
                                        // onClickChatRoom={(selectedAlertMessage) => {
                                        //     // 채팅방을 클릭했을 때의 동작
                                        // }}
                                    />
                                    {/* 필요하다면 모달 닫기 버튼도 추가 */}
                                </div>
                            </div>
                        )}
                     <button onClick={handleAlertMessageClick}>메시지 리스트</button>
                </>
            ) : (
                <>
                    <input type="email" placeholder="Email" onChange={e => setEmail(e.target.value)} />
                    <input type="password" placeholder="Password" onChange={e => setPassword(e.target.value)} />
                    <button onClick={signIn}>로그인</button>
                    <button onClick={() => setShowModal(true)}>회원가입</button>
                </>
            )}
    
            {showModal && (
                <div className="modal">
                    <div className="modal-content">
                        <span className="close" onClick={() => setShowModal(false)}>&times;</span>
                        <input
                            type="email" 
                            placeholder="Email" 
                            value={email} 
                            onChange={e => setEmail(e.target.value)} 
                            disabled={!!user}   //user 객체의 존재 여부를 boolean으로 
                        />
                        <input
                            type="password" 
                            placeholder="Password"
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            disabled={!!user} 
                        />
                        <input type="text" placeholder="연락처" value={contact} onChange={e => setContact(e.target.value)} />
                        <input type="text" placeholder="주소" value={address} onChange={e => setAddress(e.target.value)} />
                        {user ? (
                            <>
                                <button onClick={updateUserDetails}>정보 수정</button>
                                <button onClick={deleteUserAccount}>회원 탈퇴</button>
                            </>
                        ) : (
                            <button onClick={signUp}>회원가입 완료</button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );    
}

export default Auth;