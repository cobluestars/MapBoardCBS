import React, { useEffect, useState, useRef, useReducer } from 'react';
import './CustomMenu.css'
import CustomForm from './CustomForm';
import { v4 as uuidv4 } from 'uuid';

//firestore
import { collection, getDocs, addDoc, updateDoc, deleteDoc, query, where, doc, getDoc, setDoc, deleteField } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';

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
        endDate: ""
    },
    tempMarker: null
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
    const [state, dispatch] = useReducer(reducer, initialState);
    const [formData, setFormData] = useState(initialState.formState);
    const tempMarkerPosition = useRef(null);
    const tempMarkerRef = useRef(null);
    const [formState, setFormState] = useState(data || {
        category: '무엇을 할 것인지 선택하세요',
        title: '',
        content: '',
        startDate: '',
        endDate: '',
        mode: 'register',
    });
    const [location, setLocation] = useState(null); 
    const [editing, setEditing] = useState(false);
    const [editingMarkerId, setEditingMarkerId] = useState(null);
    const [formPosition, setFormPosition] = useState({ left: 0, top: 0 });

    //검색 기능
    
    // CustomMenu 컴포넌트
    const customMenuMarkersRef = useRef([]);
    const [searchCategory, setSearchCategory] = useState(''); // 검색할 카테고리 상태
    const [searchKeyword, setSearchKeyword] = useState('');   // 검색할 키워드 상태
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

    useEffect(() => {
        // 로그인 상태가 변경될 때마다 user 상태를 업데이트
        const unsubscribe = onAuthStateChanged(auth, currentUser => {
            setUser(currentUser);
        });

        // 컴포넌트 unmount 시 unsubscribe
        return () => unsubscribe();
    }, []);
 
    const [showEditFeatures, setShowEditFeatures] = useState(false);

    function enableMarkerEditingFeatures() {
        setShowEditFeatures(true);
    }
    
    function showBasicMarkerInfo() {
        setShowEditFeatures(false);
    }

    const loadMarkers = async () => {
        // 기존 마커들과 오버레이를 모두 지우기
        markersRef.current.forEach(markerRef => {
            markerRef.markerObject.setMap(null);
            if (markerRef.overlay) markerRef.overlay.setMap(null);
        });
        markersRef.current = [];
        
        try {
            const markersCollection = collection(db, 'markers');
            const markerSnapshot = await getDocs(markersCollection);
            const markersData = markerSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            const newMarkers = markersData.map(markerData => {
                if (markerData.id === 'TEMP_MARKER') {  //임시마커는 데이터를 등록하기 이전 단계이므로 예외 처리
                    return {};
                }

                if (!markerData.position || !markerData.data || !markerData.data.category) {
                    console.error('Position, Data, or Category is missing', markerData);
                    return {};
                }
                            
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

                    // const markersData = markerSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    // console.log("Loaded markers data:", markersData);

                    // console.log("Setting formData with marker data:", markerData.data);
                    setFormData({ 
                        ...markerData.data, 
                        position: { lat, lng }, 
                        userId: markerData.userId 
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
                        payload: { id: markerData.id, markerObject: marker, data: markerData.data, position: markerData.position, overlay: customOverlay, userId: markerData.userId }
                    });
                });

                return { id: markerData.id, markerObject: marker, data: markerData.data, position: markerData.position, overlay: customOverlay, userId: markerData.userId };
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
        if (!state.showForm) {  // 폼이 닫힐 때
            markersRef.current.forEach(markerRef => {
                markerRef.markerObject.setImage(originalMarkerImage);  // 모든 마커를 원래의 이미지로 변경
            });
            enableMapInteractions();
        }
    }, [state.showForm]);


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
    
    //2. 카테고리로 검색
    const handleCategorySearch = () => {
        const allMarkers = state.allMarkers;
    
        const filteredMarkers = allMarkers.filter(markerData => {
            const { category } = markerData.data;
            
            return !searchCategory || category === searchCategory;
        });
    
        dispatch({ type: actionTypes.SET_VISIBLE_MARKERS, payload: filteredMarkers });
        updateVisibleMarkersOnMap(filteredMarkers); // 필터링된 마커들을 지도에 업데이트
    };
    
    //3. 내 마커만 검색
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

    const handleClose = () => {
        dispatch({ type: actionTypes.TOGGLE_FORM });
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
    
        // id와 position을 formState에서 분리
        const { id, position, ...restFormState } = formState;
    
        const newMarker = {
            id: editingMarkerId || uuidv4(), // 편집 중인 마커가 있으면 그 ID를 사용, 없으면 새로운 ID 생성
            position: positionValue,
            data: restFormState,
            userId: user.uid  // Firebase 사용자의 UID 저장
        };
    
        try {
            const markersRef = collection(db, 'markers');
            if (editingMarkerId) {
                // Firestore에 수정된 데이터로 업데이트
                const markerDoc = doc(markersRef, editingMarkerId);
                await updateDoc(markerDoc, newMarker);
            } else {
                // Firestore에 새로운 마커 데이터 추가
                await addDoc(markersRef, newMarker);
            }
    
            setEditing(false);
            localStorage.removeItem('tempMarkerPosition');
            setFormData({ ...formState, mode: 'view' });
            
            await loadMarkers();
            dispatch({ type: actionTypes.TOGGLE_FORM });
    
            return { mode: 'view' };
    
        } catch (error) {
            console.error('Error:', error);
        }
    };    

    const handleDelete = async (id) => {
    
        const isConfirmed = window.confirm('정말로 삭제하시겠습니까?');
        if (!isConfirmed) return;
        
        try {
            const firebaseMarkersRef = collection(db, 'markers');

            let markerIdToDelete = id; // 주어진 id로 초기화
        
            // Firestore에서 id 필드 값을 기반으로 문서를 검색
            const q = query(firebaseMarkersRef, where("id", "==", markerIdToDelete));
    
            const querySnapshot = await getDocs(q);
    
            // 문서가 있다면 첫 번째 문서의 ID를 가져옴
            if (!querySnapshot.empty) {
                markerIdToDelete = querySnapshot.docs[0].id;
            } else {
                console.error("No documents found with the given id value");
                return;  // 아무 문서도 찾지 못한 경우 함수를 종료
            }
        
            const markerDoc = doc(firebaseMarkersRef, markerIdToDelete);
            await deleteDoc(markerDoc); // Firestore에서 해당 마커 삭제

            // 지도상의 마커 제거
            // 여기서 markersRef는 지도상의 마커 배열을 참조
            if (Array.isArray(markersRef.current)) {
                const markerToDelete = markersRef.current.find(marker => marker.id === id);
                if (markerToDelete) {
                    markerToDelete.markerObject.setMap(null);
                }
        
                // markersRef.current 배열에서 해당 마커 제거
                markersRef.current = markersRef.current.filter(marker => marker.id !== id);

                // 카테고리 이미지도 같이 제기
                if (markerToDelete.overlay) {
                    markerToDelete.overlay.setMap(null);
                }
            }

            // State에서 마커 데이터 제거
            dispatch({ type: actionTypes.REMOVE_MARKER, payload: id });
            
            console.log('마커 삭제 성공');
    
            handleClose(); // 폼 닫기
        
        } catch (error) {
            console.error('Error during deletion:', error);
            alert('삭제 중 오류가 발생했습니다.');
        }
    };
  
    const placeMarker = (event) => {
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
            position: new window.kakao.maps.LatLng(lat, lng)
        });
        tempMarker.setMap(mapRef.current);
    
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
            // 기존 리스너 삭제
            window.kakao.maps.event.removeListener(mapRef.current, 'click', placeMarker);
        
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

    return (
        <div>
            <div id="menu_wrap2" className="bg_white">
                <div className="option">
                    <p className='custommenu'>Custom Menu</p>
                     
                    {!state.showForm && <button onClick={handlePlaceMarker}>마커 배치하기</button>}
                </div>
                <div id="pagination2">
                    {/* TODO: Add pagination */}
                </div>
                <div className="search-keyword">
                    <label>키워드:</label>
                    <input type="text" value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} />
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
                    <button onClick={handleMarkerSearchToggle}>
                        {showOnlyMyMarkers ? "모든 마커 검색" : "내 마커만 검색"}
                    </button>
                </div>
            </div>
            {state.showForm && 
            <CustomForm 
                style={{ 
                    position: 'absolute', 
                    left: `${formPosition.left}px`, 
                    top: `${formPosition.top}px`,
                    zIndex: 1000,
                    width: 200,
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
                initialMode="register"
                markerId={editingMarkerId}
                onDelete={handleDelete}
                user={user}  // 여기서 user 객체가 제대로 전달되고 있는지 확인
                key={formData.userId} // formData.userId 값이 변경될 때마다 컴포넌트를 다시 렌더링
                enableEditing={enableMarkerEditingFeatures}
                showBasicInfo={showBasicMarkerInfo}
            />
        }
         </div>
    );
};

export default CustomMenu;
