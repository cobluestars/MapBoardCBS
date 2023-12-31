import React, { useEffect, useState, useRef, useReducer } from 'react';
import './CustomMenu.css'
import CustomForm from './CustomForm';
import { useChatRoom } from './ChatRoomProvider'

//firestore
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc, deleteField } from 'firebase/firestore';
import { getFirestore, serverTimestamp } from 'firebase/firestore';

//storage
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';

//TempMarkers
import { saveTempMarkerPosition, getTempMarkerPosition, deleteTempMarkerPosition } from './TempMarkers';

import { getAuth } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';

import flyerDistributorMaleImage from '../icon/icons8-flyer-distributor-male-50.png';
import workFromHomeImage from '../icon/icons8-집에서-일하십시오-30.png';
import dealImage from '../icon/icons8-거래-50.png';
import heavyImage from '../icon/icons8-heavy-50.png';
import teacherImage from '../icon/icons8-선생-50.png';
import cleaningImage from '../icon/icons8-청소-50.png';
import insuranceAgentImage from '../icon/icons8-insurance-agent-50.png';

import { v4 as uuidv4 } from 'uuid'; // chatid
import { DateTime } from 'luxon';   //신뢰할 만한 타임스탬프

import gql from 'graphql-tag';

const db = getFirestore();

// 초기 상태 정의
const initialState = {
    showForm: false,
    markers: [],
    allMarkers: [],
    visibleMarkers: [],
    isListenerActive: false,
    formState: {
        title: "",
        content: "",
        category: "무엇을 할 것인지 선택하세요",
        startDate: "",
        endDate: "",
        mediaURL: []
    },
    tempMarker: null,
    roadAddress: null,
    jibunAddress: null,
    createdAt: null,
    expiryDate: null,
    chatid: null,
    email: null,
    currentemail: null
};

// 액션 타입 정의
const actionTypes = {
    TOGGLE_LISTENER: "TOGGLE_LISTENER",
    SET_MARKERS: 'SET_MARKERS',
    SET_VISIBLE_MARKERS: "SET_VISIBLE_MARKERS",
    SET_FORM_STATE: "SET_FORM_STATE",
    ADD_MARKER: "ADD_MARKER",
    TOGGLE_FORM: "TOGGLE_FORM",
    CLEAR_TEMP_MARKER: "CLEAR_TEMP_MARKER",
    UPDATE_TEMP_MARKER_POSITION: "UPDATE_TEMP_MARKER_POSITION",
    REMOVE_MARKER: "REMOVE_MARKER"
};

// 리듀서 함수
function reducer(state, action) {
    switch (action.type) {
        case actionTypes.TOGGLE_LISTENER:
            return { ...state, isListenerActive: !state.isListenerActive };
        case actionTypes.SET_FORM_STATE:
            return { ...state, formState: { ...state.formState, ...action.payload } };
        case actionTypes.ADD_MARKER:
            return { ...state, 
                        markers: [...state.markers, action.payload],
                        tempMarker: action.payload.markerObject 
                    };
        case actionTypes.SET_MARKERS:
            return { ...state, allMarkers: action.payload };
        case actionTypes.SET_VISIBLE_MARKERS:
            return { ...state, visibleMarkers: action.payload };
        case actionTypes.TOGGLE_FORM:
            return { ...state, showForm: !state.showForm };
        case actionTypes.CLEAR_TEMP_MARKER:
            return { ...state, tempMarker: null };
        case actionTypes.UPDATE_TEMP_MARKER_POSITION:
            return { ...state, tempMarker: action.payload };
        case actionTypes.REMOVE_MARKER: {
            const markerToRemove = state.markers.find(marker => marker.id === action.payload);
            if (markerToRemove) {
                markerToRemove.markerObject.setMap(null);
            }
            const newMarkers = state.markers.filter(marker => marker.id !== action.payload);
            return { ...state, markers: newMarkers };
        };
        default:
            throw new Error(`Unknown action: ${action.type}`);    
    }
}

const CustomMenu = ({ customData, setCustomData, setIsSettingPin, places, infowindowsRef, markersRef, mapRef, data }) => {
    const { selectedChatRoom } = useChatRoom();
    const [state, dispatch] = useReducer(reducer, initialState);

    const [formData, setFormData] = useState(initialState.formState);
    const tempMarkerPosition = useRef(null);
    const tempMarkerRef = useRef(null);
    const [formState, setFormState] = useState(data || {
        ...data,
        category: data?.category || '무엇을 할 것인지 선택하세요',
        title: data?.title || '',
        content: data?.content || '',
        startDate: data?.startDate || '',
        endDate: data?.endDate || '',
        mediaURL: data?.mediaURL || [],
        mode: data?.mode || 'register',
    });
    const [location, setLocation] = useState(null); 
    const [editing, setEditing] = useState(false);
    const [editingMarkerId, setEditingMarkerId] = useState(null);
    const [formPosition, setFormPosition] = useState({ left: 0, top: 0 });

    /** 검색 기능 */
    
    // CustomMenu 컴포넌트
    const customMenuMarkersRef = useRef([]);
    const [searchKeyword, setSearchKeyword] = useState('');   // 검색할 키워드 상태
    const [searchEmail, setSearchEmail] = useState('');   // 검색할 이메일 상태
    const [searchAddress, setSearchAddress] = useState('');   // 검색할 주소 상태
    const [searchCategory, setSearchCategory] = useState(''); // 검색할 카테고리 상태
    const [showOnlyMyMarkers, setShowOnlyMyMarkers] = useState(false);
 
    const auth = getAuth();

    useEffect(() => {
        async function fetchLocation() {
            try {
                const response = await navigator.geolocation.getCurrentPosition(
                    (position) => {
                        setLocation({
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                        });
                    },
                    (error) => {
                        console.error('위치를 가져오는 동안 에러가 발생했습니다:', error);
                    }
                );
            } catch (error) {
                console.error('위치를 가져오는 동안 에러가 발생했습니다:', error);
            }
        }
    
        fetchLocation();
    }, []);

    useEffect(() => {
        if (location && mapRef.current) {
            const point = mapRef.current.getProjection().pointFromCoords(new window.kakao.maps.LatLng(location.lat, location.lng));
            setFormPosition({
                left: point.x,
                top: point.y,
            });
        }
    }, [location, mapRef]);

    useEffect(() => {
         // firestore에서 editingMarkerId 값을 가져오기
        async function fetchStoredEditingMarkerId() {
            const userSettingsRef = doc(db, 'userSettings', 'currentUserId');
            const userSettingsSnapshot = await getDoc(userSettingsRef);
    
            if (userSettingsSnapshot.exists() && userSettingsSnapshot.data().editingMarkerId) {
                const storedEditingMarkerId = userSettingsSnapshot.data().editingMarkerId;
                setEditingMarkerId(storedEditingMarkerId);
            }
        }
    
        fetchStoredEditingMarkerId();
    }, []);    

    useEffect(() => {
        //Firestore에 editingMarkerId 저장하기
        async function storeEditingMarkerId() {
            const userSettingsRef = doc(db, 'userSettings', 'currentUserId');
    
            if (editingMarkerId) {
                await setDoc(userSettingsRef, { editingMarkerId: editingMarkerId }, { merge: true });
            } else {
                await setDoc(userSettingsRef, { editingMarkerId: deleteField() }, { merge: true });
            }
        }
    
        storeEditingMarkerId();
    }, [editingMarkerId]);
    
    let prevClickedMarker = null; // 이전에 클릭된 마커를 저장하기 위한 전역 변수

    const clickedMarkerImageSrc = "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png";
    const originalMarkerImageSrc = "http://t1.daumcdn.net/localimg/localimages/07/2018/pc/img/marker_spot.png";
    const imageSize = new window.kakao.maps.Size(29, 42);

    const clickedMarkerImage = new window.kakao.maps.MarkerImage(clickedMarkerImageSrc, imageSize);
    const originalMarkerImage = new window.kakao.maps.MarkerImage(originalMarkerImageSrc, imageSize);

    // 카테고리별 이미지 URL 관리
    const categoryImages = {
        // 카테고리별 이미지 관리
        "알바": flyerDistributorMaleImage,
        "프리랜서": workFromHomeImage,
        "직거래": dealImage,
        "심부름": heavyImage,
        "과외": teacherImage,
        "청소": cleaningImage,
        "대리인": insuranceAgentImage
        // "알바": "https://icons8.com/icon/kcnGbq5rkn7f/flyer-distributor-male",
        // "프리랜서": "https://icons8.com/icon/tZRJsGERvYuF/%EC%A7%91%EC%97%90%EC%84%9C-%EC%9D%BC%ED%95%98%EC%8B%AD%EC%8B%9C%EC%98%A4",
        // "직거래": "https://icons8.com/icon/10081/%EB%AA%A8%EC%9E%84",
        // "심부름": "https://icons8.com/icon/yCFEu4wgksgu/heavy",
        // "과외": "https://icons8.com/icon/L9KxyvpfmbOv/%EC%84%A0%EC%83%9D",
        // "청소": "https://icons8.com/icon/8088/%EA%B0%80%EC%A0%95",
        // "대리인": "https://icons8.com/icon/q7KVnDhMjr3b/insurance-agent"
    };
    const overlayContent = `<img src="${categoryImages}" width="20px" height="20px" alt="crash" style="position: absolute; bottom: 40px; left: -12px;">`;

    useEffect(() => {
        // visibleMarkers 상태가 변경되면, 지도에 표시되는 마커들과 오버레이들을 업데이트
        
        // 먼저, 모든 마커와 오버레이의 지도 표시를 해제
        markersRef.current.forEach(markerRef => {
            if (markerRef && typeof markerRef.markerObject.setMap === 'function') {
                markerRef.markerObject.setMap(null);
            }
            if (markerRef.overlay) {
                markerRef.overlay.setMap(null);
            }
        });
        markersRef.current = []; // 기존 마커들을 초기화
    
        // 그 다음, visibleMarkers에 있는 마커들만 지도에 표시
        state.visibleMarkers.forEach(marker => {
            if (marker && typeof marker.markerObject.setMap === 'function') {
                marker.markerObject.setMap(mapRef.current);
                if (marker.overlay) {
                    marker.overlay.setMap(mapRef.current);
                }
            }
            markersRef.current.push(marker); // 새로 표시된 마커와 오버레이를 ref에 추가
        });
    }, [state.visibleMarkers, mapRef]);

    function disableMapInteractions() {     //(커스텀 폼을 열 때) 지도를 얼림
        mapRef.current.setDraggable(false); // 드래그 이동 불가
        mapRef.current.setZoomable(false);  // 줌 인/아웃 불가
    }
    
    function enableMapInteractions() {      //(커스텀 폼을 닫을 때) 지도를 활성화
        mapRef.current.setDraggable(true); 
        mapRef.current.setZoomable(true);  
    }

    // user 상태와 setUser 함수 정의
    const [user, setUser] = useState(null);
    // 로딩 상태 초기화
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 로그인 상태가 변경될 때마다 user 상태를 업데이트
        const unsubscribe = onAuthStateChanged(auth, currentUser => {
            if (currentUser) {
                setUser({
                    email: currentUser.email,
                    uid: currentUser.uid,
                });
            } else {
                setUser(null);
            }
            setLoading(false);  // user 상태 업데이트 후 로딩 상태 업데이트
        });
        // 컴포넌트 unmount 시 unsubscribe
        return () => unsubscribe();
    }, []);    
    
    if (user) {
        console.log(user.email);
    } else {
        console.log("User is not logged in...");
    }    

    const [showEditFeatures, setShowEditFeatures] = useState(false);

    function enableMarkerEditingFeatures() {
        setShowEditFeatures(true);
    }
    
    function showBasicMarkerInfo() {
        setShowEditFeatures(false);
    }

    const loadMarkers = async () => {
        // Kakao 지도 API 스크립트가 로드되었는지 확인
        if (!window.kakao || !window.kakao.maps) {
            console.error("Kakao maps API has not been loaded");
            return;
        }
        
        // 기존 마커들과 오버레이를 모두 지우기
        markersRef.current.forEach(markerRef => {
            markerRef.markerObject.setMap(null);
            if (markerRef.overlay) markerRef.overlay.setMap(null);
        });
        markersRef.current = [];
        
        const fetchMediaURLs = async (gsURLs) => {
            const storage = getStorage();
            return await Promise.all(gsURLs.map(async gsURL => {
                const storageRef = ref(storage, gsURL.replace('gs://mapboard-35c14.appspot.com/', ''));
                return await getDownloadURL(storageRef);
            }));
        };
        
        try {
            const markersCollection = collection(db, 'markers');
            const markerSnapshot = await getDocs(markersCollection);
            const markersData = markerSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), currentemail: user?.email }));
        
            // gsURL들을 HTTP URL로 변환
            const updatedMarkersData = await Promise.all(
                markersData.map(async markerData => {
                    if (markerData && markerData.data && markerData.data.mediaURL && Array.isArray(markerData.data.mediaURL)) {
                        const httpURLs = await fetchMediaURLs(markerData.data.mediaURL);
                        return { ...markerData, data: { ...markerData.data, mediaURL: httpURLs }};
                    }
                    return markerData;
                })
            );        

            const newMarkers = updatedMarkersData.map(markerData => {
             
                if (markerData.id === 'TEMP_MARKER') {  
                //임시마커는 데이터를 등록하기 이전 단계이므로 예외 처리
                    return {};
                }            

                if (!markerData.data) {//그 외 데이터가 없는 마커들 처리
                    console.warn("Missing data for marker:", markerData);
                    return {};
                }

                if (!markerData.position || !markerData.data || !markerData.data.category) {
                    console.error('Position, Data, or Category is missing', markerData);
                    return {};
                }
            
                // 이미 처리된 mediaURLs를 사용
                const mediaURLs = markerData.data.mediaURL;

                const { position } = markerData;
                const data = markerData.data || {};

                let customOverlay;  // 여기서 customOverlay를 정의해주기
                let categoryImageSrc;
                
                if (data.category) {
                    categoryImageSrc = categoryImages[data.category];
                } else {
                    console.warn("Category is missing for marker:", markerData);
                }                
            
                // 카테고리에 해당하는 이미지를 사용해서 커스텀 오버레이 생성
                if (categoryImageSrc) {
                    const overlayContent = `<img src="${categoryImageSrc}" width="36px" height="37px" style="position: absolute; bottom: 37px; left: -18px;">`;
                    customOverlay = new window.kakao.maps.CustomOverlay({
                        content: overlayContent,
                        position: new window.kakao.maps.LatLng(position.lat, position.lng),
                        yAnchor: 1
                    });
                    customOverlay.setMap(mapRef.current);
                }    

                const marker = new window.kakao.maps.Marker({
                    position: new window.kakao.maps.LatLng(position.lat, position.lng),
                    map: mapRef.current,
                });
                            
                // 마커 클릭 이벤트 리스너 추가  
                window.kakao.maps.event.addListener(marker, 'click', () => {

                    setEditingMarkerId(markerData.id);
                    disableMapInteractions();

                    // 이전에 클릭된 마커가 있다면 이미지를 원래대로 변경
                    if (prevClickedMarker) {
                        prevClickedMarker.setImage(originalMarkerImage);
                    }
                    
                    // 현재 클릭된 마커의 이미지를 변경
                    marker.setImage(clickedMarkerImage);

                    // 이전 클릭된 마커 업데이트
                    prevClickedMarker = marker;

                    const lat = marker.getPosition().getLat();
                    const lng = marker.getPosition().getLng();

                    const point = mapRef.current.getProjection().pointFromCoords(new window.kakao.maps.LatLng(lat, lng));

                    // 폼의 위치를 마커의 위치에서 카테고리 이미지 높이만큼 위로 조정
                    const adjustedTop = point.y - 37;

                    // 현재 마커의 userId와 로그인한 사용자의 uid가 같은지도 확인
                    if (user?.uid === markerData.userId) {
                        enableMarkerEditingFeatures();
                    } else {
                        showBasicMarkerInfo();
                    }

                    setFormPosition({
                        left: point.x,
                        top: adjustedTop
                    });

                    setFormData({ 
                        ...markerData.data, 
                        chatid: markerData.chatid,
                        position: { lat, lng },
                        roadAddress: markerData.roadAddress,
                        jibunAddress: markerData.jibunAddress,
                        userId: markerData.userId,
                        mediaURL: mediaURLs, // 배열로 설정
                        createdAt: markerData.createdAt,
                        expiryDate: markerData.expiryDate,
                        email: markerData.email,
                        currentemail: markerData.currentemail
                    });

                    setFormState(prevState => ({
                        ...prevState,
                        // mode: 'view',
                    }));

                    dispatch({
                        type: actionTypes.TOGGLE_FORM,
                    });
                    dispatch({
                        type: actionTypes.ADD_MARKER,
                        payload: { 
                            id: markerData.id, 
                            markerObject: marker, 
                            data: markerData.data,
                            chatid: markerData.chatid, 
                            position: markerData.position,
                            roadAddress: markerData.roadAddress,
                            jibunAddress: markerData.jibunAddress,
                            overlay: customOverlay, 
                            userId: markerData.userId,
                            mediaURL: mediaURLs,
                            createdAt: markerData.createdAt,
                            expiryDate: markerData.expiryDate,
                            email: markerData.email,
                            currentemail: markerData.currentemail
                        }
                    });                
                });

                return { 
                    id: markerData.id, 
                    markerObject: marker, 
                    data: markerData.data, 
                    chatid: markerData.chatid,
                    position: markerData.position,
                    roadAddress: markerData.roadAddress,
                    jibunAddress: markerData.jibunAddress,
                    overlay: customOverlay, 
                    userId: markerData.userId,
                    mediaURL: mediaURLs,
                    createdAt: markerData.createdAt,
                    expiryDate: markerData.expiryDate,
                    email: markerData.email,
                    currentemail: markerData.currentemail
                };
            }).filter(marker => marker.id); // 필터링하여 빈 객체 제거

            markersRef.current = [...newMarkers];
    
            const markersToDisplay = state.visibleMarkers.length > 0 ? state.visibleMarkers : newMarkers;
        
            dispatch({ type: actionTypes.SET_MARKERS, payload: newMarkers });
            dispatch({ type: actionTypes.SET_VISIBLE_MARKERS, payload: markersToDisplay });
    
        } catch (error) {
            console.error('Error:', error);
        }
    };

    useEffect(() => {
        // 메세지 리스트에서 해당 채팅룸을 가진 마커로 이동
        if (selectedChatRoom && selectedChatRoom.chatid) {
            const matchingMarker = state.markers.find(marker => marker.chatid === selectedChatRoom.chatid);
            if (matchingMarker && mapRef.current) {
                // 마커 위치로 지도 중심 이동
                mapRef.current.panTo(new window.kakao.maps.LatLng(matchingMarker.position.lat, matchingMarker.position.lng));                

                // 이전에 클릭된 마커가 있다면 이미지를 원래대로 변경
                if (prevClickedMarker) {
                    prevClickedMarker.setImage(originalMarkerImage);
                }
                
                // 현재 선택된 마커의 이미지를 변경
                matchingMarker.markerObject.setImage(clickedMarkerImage);

                // 이전 클릭된 마커 업데이트
                prevClickedMarker = matchingMarker.markerObject;

                dispatch({
                    type: actionTypes.TOGGLE_FORM,
                });
            }
        }
    }, [selectedChatRoom]);

    const { kakao } = window;

    // Geocoder 객체 초기화
    const geocoder = new window.kakao.maps.services.Geocoder();

    useEffect(() => {
        if (!state.showForm) {  // 폼이 닫힐 때
            markersRef.current.forEach(markerRef => {
                markerRef.markerObject.setImage(originalMarkerImage);  // 모든 마커를 원래의 이미지로 변경
            });
            enableMapInteractions();
        }
    }, [state.showForm]);

    const handleClose = () => {
        dispatch({ type: actionTypes.TOGGLE_FORM });
    }

    async function createChatroom(chatid) { //마커 생성 시 chatroom도 생성
        const CREATE_CHATROOM_MUTATION = `
          mutation CreateChatroom($chatid: String!) {
            createChatroom(input: { chatid: $chatid }) {
              chatid
            }
          }
        `;
      
        const response = await fetch("http://localhost:4000/graphql", {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: CREATE_CHATROOM_MUTATION,
            variables: {
              chatid
            }
          })
        });
      
        const responseData = await response.json();
        console.log(responseData);  // 응답 데이터 로깅

        return responseData.data.createChatroom;
    }
      
    async function deleteChatroom(chatid) {//마커 삭제(chatid 삭제) 시 채팅방도 삭제
        const DELETE_CHATROOM_MUTATION = `
          mutation DeleteChatroom($chatid: String!) {
            deleteChatroom(chatid: $chatid) {
              chatid
            }
          }
        `;
      
        const response = await fetch("http://localhost:4000/graphql", {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: DELETE_CHATROOM_MUTATION,
            variables: {
              chatid
            }
          })
        });
      
        const responseData = await response.json();
        console.log(responseData);  // 응답 데이터 로깅
      
        return responseData.data.deleteChatroom;
    }

    const registerHandler = async (formState) => {

        const { startDate, endDate } = state.formState;
        const { category, mode } = formState;
    
        if (mode === 'register' && category === "무엇을 할 것인지 선택하세요") {
            alert("무엇을 할 것인지 선택하세요.");
            return;
        }
    
        if (startDate && endDate && endDate < startDate) {
            alert("공고 종료가 공고 시작보다 이전일 수 없습니다.");
            return;
        }
    
        if (tempMarkerRef.current) {
            tempMarkerRef.current.setMap(null);
            tempMarkerRef.current = null;
        }   
    
        const positionValue = editingMarkerId ? (state.markers.find(marker => marker.id === editingMarkerId) || {}).position : tempMarkerPosition.current;
    
        if (!positionValue) {
            console.error("Position value is missing or undefined");
            return;
        }
        
        // Kakao Maps API를 사용하여 주소 정보를 가져오는 함수
        const fetchAddressFromCoords = async (coords) => {
            return new Promise((resolve, reject) => {
                geocoder.coord2Address(coords.lng, coords.lat, (result, status) => {
                    if (status === kakao.maps.services.Status.OK) {
                        const detailAddr = !!result[0].road_address ? result[0].road_address.address_name : null;
                        const jibunAddr = result[0].address.address_name;
                        resolve({
                            roadAddress: detailAddr,
                            jibunAddress: jibunAddr
                        });
                    } else {
                        reject(new Error("Failed to fetch address"));
                    }
                });
            });
        }

        const { id, chatid, position, userId, createdAt, email, expiryDate, MarkerAddress, ...restFormState } = formState;
        //수정 시 id, position, userId, createdAt,email, expiryDate, MarkerAddress가 db상에 중복 필드로 저장되는 걸 방지

        // mediaURL 배열에서 undefined 또는 빈 문자열을 제거
        restFormState.mediaURL = restFormState.mediaURL.filter(url => url);

        // mediaURL 배열이 비어 있으면 삭제
        if (!restFormState.mediaURL.length) {
            delete restFormState.mediaURL;
        }
        
        const newMarker = {
            position: positionValue,
            data: restFormState,
            userId: user.uid,  // Firebase 사용자의 UID 저장
        };

        if (!editingMarkerId) { 
            // 새로운 마커를 생성하는 경우
            const UniqueChatId = uuidv4(); // UUID 생성
            newMarker.createdAt = serverTimestamp();
            newMarker.expiryDate = DateTime.now().plus({ days: 30 }).toJSDate(); // 마커의 만료일 설정
            newMarker.email = user?.email;
            newMarker.chatid = UniqueChatId; // UUID를 chatid로 설정
        
            // chatroom 생성
            await createChatroom(UniqueChatId);
        
            const addressData = await fetchAddressFromCoords(positionValue);  // 주소 정보를 가져옴
            newMarker.roadAddress = addressData.roadAddress;  // 가져온 roadAddress 정보를 newMarker에 추가
            newMarker.jibunAddress = addressData.jibunAddress;  // 가져온 jibunAddress 정보를 newMarker에 추가
            
        } else {
            // 기존 마커를 수정하는 경우
            //formData의 createdAt, expiryDate, email, chatid 값을 사용
            newMarker.createdAt = formData.createdAt;
            newMarker.expiryDate = formData.expiryDate;
            newMarker.email = formData.email;
            newMarker.chatid = formData.chatid;
            newMarker.roadAddress = formData.roadAddress;
            newMarker.jibunAddress = formData.jibunAddress;
        }

        let markerIdToUpdate = editingMarkerId; // 우선 주어진 editingMarkerId로 초기화

        try {
            const markersRef = collection(db, 'markers');
    
            if (editingMarkerId) {      //update
                // Firestore에 수정된 데이터로 업데이트
                const markerDoc = doc(markersRef, editingMarkerId);
                const docSnapshot = await getDoc(markerDoc);
        
                // 문서가 있는지 확인
                if (docSnapshot.exists()) {
                    await updateDoc(markerDoc, newMarker);
                } else {
                    console.error("No document found with the given id value");
                    alert("해당 마커 정보가 변경되었거나 존재하지 않습니다. 페이지를 새로고침하거나 다른 마커를 선택해주세요."); // 사용자에게 알림 표시
                    return; // 문서를 찾지 못한 경우 함수를 종료
                }
            } else {        //create
                // Firestore에 새로운 마커 데이터 추가
                const docRef = await addDoc(markersRef, newMarker);
                // Firestore에서 생성된 고유 ID
                const firestoreDocumentId = docRef.id;
                // console.log("New Firestore document ID:", firestoreDocumentId);
            }    

            setEditing(false);
            localStorage.removeItem('tempMarkerPosition');
            setFormData({ ...formState, mode: 'view' });
            
            await loadMarkers();
            dispatch({ type: actionTypes.TOGGLE_FORM });
    
            if (tempMarkerRef.current) {
                tempMarkerRef.current.setImage(originalMarkerImage);
            }

            return { mode: 'view' };
    
        } catch (error) {
            console.error('Error:', error);
        }
    };    

    const deleteImageFromStorage = async (imageUrl) => {
        const storage = getStorage();
        const imageRef = ref(storage, imageUrl);
        
        try {
            await deleteObject(imageRef);
            console.log('Image deleted from Firebase Storage.');
        } catch (error) {
            console.error('Error deleting image from Firebase Storage:', error);
        }
    };    

    const handleDelete = async (id, isAutoDelete = false) => {
        if (!isAutoDelete) {  // 자동 삭제가 아닌 경우에만 알림창 표시
            const isConfirmed = window.confirm('정말로 삭제하시겠습니까?');
            if (!isConfirmed) return;
        }
    
        try {
            const firebaseMarkersRef = collection(db, 'markers');
    
            // 주어진 id로 바로 문서를 참조
            const markerDoc = doc(firebaseMarkersRef, id);
            const docSnapshot = await getDoc(markerDoc);
    
            // 문서가 있는지 확인
            if (!docSnapshot.exists()) {
                console.error("No document found with the given id value");
                return;
            }
    
            const markerToDelete = markersRef.current.find(marker => marker.id === id);
            if (markerToDelete && markerToDelete.chatid) {
              await deleteChatroom(markerToDelete.chatid);  // 채팅룸 삭제
            }
            if (markerToDelete) {
                markerToDelete.markerObject.setMap(null);
                if (markerToDelete.overlay) {
                    markerToDelete.overlay.setMap(null);
                }
            }
    
            // markersRef.current 배열에서 해당 마커 제거
            markersRef.current = markersRef.current.filter(marker => marker.id !== id);
    
            // 삭제되는 마커에 있는 mediaURL들이 다른 마커들에 존재하는지 여부 확인
            const allMarkersSnapshot = await getDocs(collection(db, 'markers'));
            const allMediaURLs = allMarkersSnapshot.docs.flatMap(doc => {
                const markerData = doc.data();
                return markerData.data && markerData.data.mediaURL ? markerData.data.mediaURL : [];
            });
    
            if (markerToDelete && markerToDelete.data && markerToDelete.data.mediaURL) {
                for (const url of markerToDelete.data.mediaURL) {
                    if (!allMediaURLs.includes(url)) {
                        await deleteImageFromStorage(url);  // 해당 URL이 다른 마커에서 참조되지 않는다면 스토리지에서 삭제
                    }
                }
            }
    
            // 해당 마커 데이터를 Firestore에서 삭제
            await deleteDoc(markerDoc);
    
            // State에서 마커 데이터 제거
            dispatch({ type: actionTypes.REMOVE_MARKER, payload: id });
    
            console.log('마커 삭제 성공');
    
            handleClose(); // 폼 닫기
    
        } catch (error) {
            console.error('Error during deletion:', error);
            alert('삭제 중 오류가 발생했습니다.');
        }
    };

    // 1시간 주기로 마커 생성 이후 30일이 지났는지 검사하는 로직
    setInterval(async () => {
        const markersRef = collection(db, 'markers');
        const allMarkersSnapshot = await getDocs(markersRef);

        allMarkersSnapshot.docs.forEach(async doc => {
            const markerData = doc.data();
            const markerExpiryDate = DateTime.fromJSDate(markerData.expiryDate);

            if (DateTime.now() > markerExpiryDate) {
                handleDelete(doc.id, true);  // 자동 삭제 플래그 설정하여 호출
            }
        });
    }, 60 * 60 * 1000);  // 매 시간마다 한 번씩 검사
            
    const placeMarker = (event) => {
        if (prevClickedMarker) {
            prevClickedMarker.setImage(originalMarkerImage);
            prevClickedMarker = null;
        }

        console.log(event.latLng);
        
        if (state.tempMarker) {
            state.tempMarker.setMap(null);
        }
    
        const lat = event.latLng.getLat();
        const lng = event.latLng.getLng();
    
        const newPosition = { lat, lng };
    
        const savePosition = async () => {
            await saveTempMarkerPosition(newPosition);
        };
        savePosition();
    
        dispatch({
            type: actionTypes.UPDATE_TEMP_MARKER_POSITION,
            payload: newPosition,
        });
    
        tempMarkerPosition.current = {
            lat: lat,
            lng: lng
        };
    
        const tempMarker = new window.kakao.maps.Marker({
            position: new window.kakao.maps.LatLng(lat, lng),
            image: clickedMarkerImage
        });
        tempMarker.setMap(mapRef.current);
        
        tempMarkerRef.current = tempMarker;

        // 마커 클릭 이벤트 리스너 추가
        window.kakao.maps.event.addListener(tempMarker, 'click', () => {
            dispatch({ type: actionTypes.TOGGLE_FORM });
            const point = mapRef.current.getProjection().pointFromCoords(new window.kakao.maps.LatLng(lat, lng));
            setFormPosition({
                left: point.x,
                top: point.y,
            });
        });
    
        dispatch({
            type: actionTypes.ADD_MARKER,
            payload: { tempMarker }
        });
    
        dispatch({ type: actionTypes.TOGGLE_LISTENER });
        window.kakao.maps.event.removeListener(mapRef.current, 'click', placeMarker);        
    };
    
    useEffect(() => {
        // 페이지 로드 시 임시 마커 삭제
        const deletePosition = async () => {
            await deleteTempMarkerPosition();
        };
        deletePosition();
    
        if (tempMarkerRef.current) {
            tempMarkerRef.current.setMap(null);
            tempMarkerRef.current = null;
        }
    }, []);

    const handlePlaceMarker = () => {
        if (mapRef && mapRef.current) {
              
            // 이전에 클릭된 마커가 있다면 이미지를 원래대로 변경하고 참조를 null로 설정
            if (prevClickedMarker) {
                prevClickedMarker.setImage(originalMarkerImage);
                window.kakao.maps.event.removeListener(prevClickedMarker, 'click'); // 이전에 클릭했던 마커의 클릭 리스너 제거
                prevClickedMarker = null;
            }  
        
            // 수정 상태 해제
            setEditing(false);
            setEditingMarkerId(null);
        
            // form 데이터 초기화
            setFormData(initialState.formState);
        
            // 기존 임시 마커 제거
            if (state.tempMarker) {
                state.tempMarker.setMap(null);
                dispatch({ type: actionTypes.CLEAR_TEMP_MARKER });
            }
        
            disableMapInteractions();

            dispatch({ type: actionTypes.TOGGLE_LISTENER });
            if (state.isListenerActive) {
                document.body.classList.remove("marker-cursor");
            } else {
                window.kakao.maps.event.addListener(mapRef.current, 'click', placeMarker);
                document.body.classList.add("marker-cursor");
            }

            loadMarkers();  //마커 등록하는 와중에도 마커 등록 상황 실시간 업로드
        }
    };    

    useEffect(() => {
        if (state.isListenerActive) {
            document.body.classList.add('marker-cursor');
        } else {
            document.body.classList.remove('marker-cursor');
        }
    }, [state.isListenerActive]);

    useEffect(() => {
        const updateAndRemoveTempMarker = async () => {
            const savedPosition = await getTempMarkerPosition();  // Firestore에서 임시 마커의 위치를 가져옴
    
            if (savedPosition) {
                tempMarkerPosition.current = savedPosition;
                const tempMarker = new window.kakao.maps.Marker({
                    position: new window.kakao.maps.LatLng(savedPosition.lat, savedPosition.lng)
                });
                tempMarker.setMap(null);  // 임시 마커를 지도에서 삭제
                dispatch({
                    type: actionTypes.REMOVE_MARKER,  // 임시 마커를 상태에서 삭제하는 액션
                    payload: tempMarker
                });
    
                await deleteTempMarkerPosition();  // Firestore에서 임시 마커의 위치 데이터를 삭제
            }
        };
    
        updateAndRemoveTempMarker();  // 페이지가 새로고침될 때 임시 마커 위치 업데이트 및 삭제
        loadMarkers();
    }, []);

    // 지도의 중심과 레벨을 필터링된 마커들을 기준으로 재설정
    const resetMapBounds = (filteredMarkers) => {
        const bounds = new kakao.maps.LatLngBounds();
        
        filteredMarkers.forEach(markerData => {
            const position = markerData.markerObject.getPosition();
            bounds.extend(position);
        });

        mapRef.current.setBounds(bounds);
    };

    const updateVisibleMarkersOnMap = (visibleMarkers) => {
        // 모든 마커와 오버레이의 지도 표시를 해제
        markersRef.current.forEach(markerRef => {
            if (markerRef && typeof markerRef.markerObject.setMap === 'function') {
                markerRef.markerObject.setMap(null);
            }
            if (markerRef.overlay) {
                markerRef.overlay.setMap(null);
            }
        });
        markersRef.current = []; // 기존 마커들을 초기화

        // 필터링된 마커들을 지도에 추가
        visibleMarkers.forEach(marker => {
            if (marker && typeof marker.markerObject.setMap === 'function') {
                marker.markerObject.setMap(mapRef.current);
                if (marker.overlay) {
                    marker.overlay.setMap(mapRef.current);
                }
            }
            markersRef.current.push(marker);
        });

        resetMapBounds(visibleMarkers); 
        // 지도의 중심과 레벨을 필터링된 마커들을 기준으로 재설정
    };
    
    //1. 키워드로 검색
    const handleSearch = () => {
        const allMarkers = state.allMarkers;

        const filteredMarkers = allMarkers.filter(markerData => {
            const { title, content } = markerData.data;

            return title.includes(searchKeyword) || content.includes(searchKeyword);
        });
    
        dispatch({ type: actionTypes.SET_VISIBLE_MARKERS, payload: filteredMarkers });
        updateVisibleMarkersOnMap(filteredMarkers); // 필터링된 마커들을 지도에 업데이트
    };
    
    //2. 이메일로 검색
    const handleEmailSearch = () => {
        const allMarkers = state.allMarkers;
    
        const filteredMarkers = allMarkers.filter(markerData => {
            const email = markerData.email;

            return email.includes(searchEmail)
        });
    
        dispatch({ type: actionTypes.SET_VISIBLE_MARKERS, payload: filteredMarkers });
        updateVisibleMarkersOnMap(filteredMarkers); // 필터링된 마커들을 지도에 업데이트
    };

    //3. 주소로 검색
    const handleAddressSearch = () => {
        const allMarkers = state.allMarkers;

        const filteredMarkers = allMarkers.filter(markerData => {
            const { roadAddress, jibunAddresst } = markerData.data;

            return roadAddress.includes(searchKeyword) || jibunAddresst.includes(searchKeyword);
        });
    
        dispatch({ type: actionTypes.SET_VISIBLE_MARKERS, payload: filteredMarkers });
        updateVisibleMarkersOnMap(filteredMarkers); // 필터링된 마커들을 지도에 업데이트
    };

    //4. 카테고리로 검색
    const handleCategorySearch = () => {
        const allMarkers = state.allMarkers;
    
        const filteredMarkers = allMarkers.filter(markerData => {
            const { category } = markerData.data;
            
            return !searchCategory || category === searchCategory;
        });
    
        dispatch({ type: actionTypes.SET_VISIBLE_MARKERS, payload: filteredMarkers });
        updateVisibleMarkersOnMap(filteredMarkers); // 필터링된 마커들을 지도에 업데이트
    };
    
    //5. 내 마커만 검색
    const handleMyMarkersSearch = () => {
        const allMarkers = state.allMarkers;
    
        const filteredMarkers = allMarkers.filter(markerData => markerData.userId === user.uid);
    
        dispatch({ type: actionTypes.SET_VISIBLE_MARKERS, payload: filteredMarkers });
        updateVisibleMarkersOnMap(filteredMarkers); // 필터링된 마커들을 지도에 업데이트
    };
    
    const handleMarkerSearchToggle = () => {
        if (showOnlyMyMarkers) {
            // 현재 '내 마커만 검색' 기능이 활성화된 상태
            // 모든 마커를 다시 표시
            dispatch({ type: actionTypes.SET_VISIBLE_MARKERS, payload: state.allMarkers });
        } else {
            // '내 마커만 검색' 기능이 비활성화된 상태
            // 내 마커만 표시
            const myMarkers = state.allMarkers.filter(markerData => markerData.userId === user.uid);
            dispatch({ type: actionTypes.SET_VISIBLE_MARKERS, payload: myMarkers });
        }
        setShowOnlyMyMarkers(!showOnlyMyMarkers);
    };

    return (
        <div>
            <div id="menu_wrap2" className="bg_white">
                <div className="option">
                    <p className='custommenu'>Custom Menu</p>
                    { user ? ( 
                    !state.showForm && <button onClick={handlePlaceMarker}>마커 배치하기</button>
                    ) : null }
                </div>
                <hr/>
                <div className="search-keyword">
                    <label>키워드:</label>
                    <input type="text" value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} />
                    <button onClick={handleSearch}>검색</button>
                </div>
                <div className="search-email">
                    <label>ID:</label>
                    <input type="text" value={searchEmail} onChange={e => setSearchEmail(e.target.value)} />
                    <button onClick={handleEmailSearch}>검색</button>
                </div>
                <div className="search-Address">
                    <label>주소:</label>
                    <input type="text" value={searchAddress} onChange={e => setSearchAddress(e.target.value)} />
                    <button onClick={handleSearch}>검색</button>
                </div>
                <div className="search-category">
                    <label>카테고리:</label>
                    <select value={searchCategory} onChange={e => setSearchCategory(e.target.value)}>
                        <option value="">모든 카테고리</option>
                        <option value="알바">알바</option>
                        <option value="프리랜서">프리랜서</option>
                        <option value="직거래">직거래</option>
                        <option value="심부름">심부름</option>
                        <option value="과외">과외</option>
                        <option value="청소">청소</option>
                        <option value="대리인">대리인</option>
                    </select>
                    <button onClick={handleCategorySearch}>검색</button>
                </div>          
                <div className="search-my-markers-only">
                    { user ? (
                    <button onClick={handleMarkerSearchToggle}>
                        {showOnlyMyMarkers ? "모든 마커 검색" : "내 마커만 검색"}
                    </button>
                    ) : null }
                </div>
                <div id="pagination2">
                    {/* TODO: Add pagination */}
                </div>
            </div>
            {state.showForm && 
            <CustomForm 
                style={{ 
                    position: 'absolute', 
                    left: `${formPosition.left}px`, 
                    top: `${formPosition.top}px`,
                    zIndex: 1000,
                    margin: '10px 0px 30px 10px',
                    padding: '5px',
                    overflowY: 'auto',
                    background: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '12px',
                    borderRadius: '10px'
                }}
                registerHandler={registerHandler}
                onClose={handleClose}
                data={formData}
                formData={formState}
                chatid={formData.chatid}
                position={formData.position}
                roadAddress={formData.roadAddress}
                jibunAddress={formData.jibunAddress}
                createdAt={formData.createdAt}
                email={formData.email}
                initialMode="register"
                markerId={editingMarkerId}
                onDelete={handleDelete}
                user={user}
                key={formData.userId} // formData.userId 값이 변경될 때마다 컴포넌트를 다시 렌더링
                enableEditing={enableMarkerEditingFeatures}
                showBasicInfo={showBasicMarkerInfo}
            />
        }
         </div>
    );
};

export default CustomMenu;
