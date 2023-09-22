import React, { useEffect, useState, useRef, useReducer } from 'react';
import './CustomMenu.css'
import CustomForm from './CustomForm';
import { v4 as uuidv4 } from 'uuid';

// 초기 상태 정의
const initialState = {
    showForm: false,
    markers: [],
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
    SET_FORM_STATE: "SET_FORM_STATE",
    ADD_MARKER: "ADD_MARKER",
    TOGGLE_FORM: "TOGGLE_FORM",
    CLEAR_TEMP_MARKER: "CLEAR_TEMP_MARKER",
    UPDATE_TEMP_MARKER_POSITION: "UPDATE_TEMP_MARKER_POSITION"
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
            return { ...state, markers: action.payload };
        case actionTypes.TOGGLE_FORM:
            return { ...state, showForm: !state.showForm };
        case actionTypes.CLEAR_TEMP_MARKER:
            return { ...state, tempMarker: null };
        case actionTypes.UPDATE_TEMP_MARKER_POSITION:
            return { ...state, tempMarker: action.payload };
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

    const loadMarkers = () => {
        markersRef.current = [];
        fetch('http://localhost:5000/markers')
        .then(response => response.json())
        .then(data => {
            console.log(data);  // 서버로부터 받은 데이터를 콘솔에 출력
            const newMarkers = data.map(markerData => {
                if (!markerData.position) {
                    console.error('Position data is missing', markerData);
                    return null;
                }
    
                const { position, data } = markerData;
                const marker = new window.kakao.maps.Marker({
                    position: new window.kakao.maps.LatLng(position.lat, position.lng),
                    map: mapRef.current,
                });
    
                // 마커 클릭 이벤트 리스너 추가  
                window.kakao.maps.event.addListener(marker, 'click', () => {

                    const lat = marker.getPosition().getLat();
                    const lng = marker.getPosition().getLng();

                    const point = mapRef.current.getProjection().pointFromCoords(new window.kakao.maps.LatLng(lat, lng));

                    setFormPosition({
                        left: point.x,
                        top: point.y
                    });

                    setFormData({ ...markerData.data, position: { lat, lng } });
                    setEditingMarkerId(markerData.id);
                        
                    setFormState(prevState => ({
                        ...prevState,
                        // mode: 'view',
                    }));

                    dispatch({
                        type: actionTypes.TOGGLE_FORM,
                    });
                    dispatch({
                        type: actionTypes.ADD_MARKER,
                        payload: { id: markerData.id, markerObject: marker, data: markerData.data, position: markerData.position }
                    });
                });
    
                return { id: markerData.id, markerObject: marker, data: markerData.data, position: markerData.position };
            });
    
            dispatch({ type: actionTypes.SET_MARKERS, payload: [...markersRef.current, ...newMarkers] });
        })
        .catch(error => console.error('Error:', error));
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

        // id와 position을 formState에서 분리
        const { id, position, ...restFormState } = formState;

        const newMarker = {
            id: uuidv4(), // unique ID 생성
            position: positionValue,
            data: restFormState,
        };

        if (editingMarkerId !== null) {
            // 수정된 데이터로 서버 업데이트
            try {
                const response = await fetch(`http://localhost:5000/markers/${editingMarkerId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(newMarker)
                });
    
                if (!response.ok) {
                    throw new Error('Failed to update marker');
                }
    
                console.log(response);
                const data = await response.json();
                console.log('Success:', data);
    
                localStorage.removeItem('tempMarkerPosition'); // 마커 수정이 성공한 후, Local Storage의 tempMarkerPosition 삭제
    
                const updatedMarkers = state.markers.map(marker => {
                    if (marker.id === editingMarkerId) {
                        return {
                            ...marker,
                            position: tempMarkerPosition.current,
                            data: {
                                ...formState,
                            }
                        };
                    }
                    return marker;
                });
    
                dispatch({ type: actionTypes.SET_MARKERS, payload: updatedMarkers });
                setFormData({ ...formState, mode: 'view' }); // 여기서 formData 상태를 업데이트, 모드를 'view'로 변경
                dispatch({ type: actionTypes.TOGGLE_FORM });
                setEditing(false);
                setEditingMarkerId(null);
                return { mode: 'view' }; // 모드를 'view'로 변경
            } catch (error) {
                console.error('Error:', error);
            }
        } else { // 새로운 마커 등록으로 서버 업데이트
            console.log('New Marker Data:', newMarker);
            try {
                const response = await fetch('http://localhost:5000/markers', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(newMarker)
                });
    
                if (!response.ok) {
                    throw new Error('Failed to create marker');
                }
    
                const data = await response.json();
                console.log('Success:', data);
    
                localStorage.removeItem('tempMarkerPosition'); // 마커 등록이 성공한 후, Local Storage의 tempMarkerPosition 삭제
    
                setFormData({ ...formState, mode: 'view' }); // 여기서 formData 상태를 업데이트, 모드를 'view'로 변경
                loadMarkers();
                dispatch({ type: actionTypes.TOGGLE_FORM });
                return { mode: 'view' }; // 모드를 'view'로 변경
            } catch (error) {
                console.error('Error:', error);
            }
        }
    }; 
    
    const placeMarker = (event) => {
    
        console.log(event.latLng);
    
        if (state.tempMarker) {
            state.tempMarker.setMap(null);
        }

        // 임시 마커가 이미 있을 경우 제거
        if (tempMarkerRef.current) {
            tempMarkerRef.current.setMap(null);
            tempMarkerRef.current = null;
        }
    
        const lat = event.latLng.getLat();
        const lng = event.latLng.getLng();

        const newPosition = { lat, lng };
        tempMarkerPosition.current = newPosition;
        localStorage.setItem('tempMarkerPosition', JSON.stringify(newPosition));

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
        tempMarker.setMap(mapRef.current); // 임시 마커를 생성하고 지도에 표시
    
        window.kakao.maps.event.addListener(tempMarker, 'click', () => {

            dispatch({ type: actionTypes.TOGGLE_FORM });
            const point = mapRef.current.getProjection().pointFromCoords(new window.kakao.maps.LatLng(lat, lng));

            setFormPosition({
                left: point.x,
                top: point.y,
            });
        }); // 마커 클릭 이벤트 리스너를 추가
    
        dispatch({
            type: actionTypes.ADD_MARKER,
            payload: {
                tempMarker: tempMarker
            }
        }); //임시 마커 저장
    
        dispatch({ type: actionTypes.TOGGLE_LISTENER });
    
        // 이벤트 리스너 제거
        window.kakao.maps.event.removeListener(mapRef.current, 'click', placeMarker);
    };

    const handlePlaceMarker = () => {
        if (mapRef && mapRef.current) {
            // 기존 리스너 삭제
            window.kakao.maps.event.removeListener(mapRef.current, 'click', placeMarker);
    
            // 수정 상태 해제
            setEditing(false);
            setEditingMarkerId(null);
    
            // form 데이터 초기화
            setFormData(initialState.formState);

            // 모드를 'register'로 설정
            setFormState((prevState) => ({
            ...prevState,
            mode: 'register',
           }));
    
            // 폼 열기
            dispatch({ type: actionTypes.TOGGLE_FORM });

            // 기존 임시 마커 제거
            if (state.tempMarker) {
                state.tempMarker.setMap(null);
                dispatch({ type: actionTypes.CLEAR_TEMP_MARKER });
            }
    
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
        const updateMarkerPosition = () => {
            const savedPosition = localStorage.getItem('tempMarkerPosition');
            if (savedPosition) {
                const parsedPosition = JSON.parse(savedPosition);
                tempMarkerPosition.current = parsedPosition;
                // Local storage에서 가져온 위치에 임시 마커를 생성하고 지도에 표시
                const tempMarker = new window.kakao.maps.Marker({
                    position: new window.kakao.maps.LatLng(parsedPosition.lat, parsedPosition.lng)
                });
                tempMarker.setMap(mapRef.current);
                // 생성된 임시 마커를 상태에 저장
                dispatch({
                    type: actionTypes.ADD_MARKER,
                    payload: { tempMarker }
                });
    
                // 모드를 'register'로 설정하고 폼을 열도록 변경
                setFormState((prevState) => ({
                    ...prevState,
                    mode: 'register',
                }));

                // 폼 열기
                dispatch({ type: actionTypes.TOGGLE_FORM, payload: true });
            }
        };

        updateMarkerPosition(); // 페이지가 새로고침될 때 임시 마커 위치 업데이트
        loadMarkers();
    }, []);

    return (
        <div>
            <div id="menu_wrap2" className="bg_white">
                <div className="option">
                    <p className='custommenu'>Custom Menu</p>
                     
                    <button onClick={handlePlaceMarker}>마커 배치하기</button>
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
            />
        }
         </div>
    );
};

export default CustomMenu;

//등록, 조회, 수정 모드 완료/ 집에서 다시 검토해보기
//삭제 모드 구현하기