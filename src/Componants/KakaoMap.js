import React, { useEffect, useRef, useState } from 'react';
import './KakaoMap.css'
import { auth } from './Firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

function KakaoMap(props) {
    const { onMapInitialized } = props;
    const mapContainer = useRef(null);
    const [map, setMap] = useState(null);
    const [markers, setMarkers] = useState([]);
    const [placeOverlay, setPlaceOverlay] = useState(null);
    const [activeCategory, setActiveCategory] = useState(null);
    const categoryMap = {
        "BK9": "은행",
        "MT1": "마트",
        "PM9": "약국",
        "OL7": "주유소",
        "CE7": "카페",
        "CS2": "편의점"
    };

    // 회원가입/로그인/로그아웃
    const [user, setUser] = useState(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
        
    // 회원가입 함수
    const signUp = async () => {
        try {
            await createUserWithEmailAndPassword(auth, email, password);
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

    // 사용자 상태 변경 감지
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            setUser(user);
        });
        return () => unsubscribe(); // 컴포넌트 unmount 시 unsubscribe
    }, []);

    useEffect(() => {
        if (!window.kakao || !window.kakao.maps) {
            console.error("Kakao Maps SDK not loaded");
            return;
        }

        const createdMap = new window.kakao.maps.Map(mapContainer.current, {
            center: new window.kakao.maps.LatLng(37.566826, 126.9786567),
            level: 5
        });
    
        setMap(createdMap);
        
        if (onMapInitialized) {
            onMapInitialized(createdMap);
        }  
        
        const overlay = new window.kakao.maps.CustomOverlay({zIndex:1});
        const contentNode = document.createElement('div');
        contentNode.className = 'placeinfo_wrap';
        overlay.setContent(contentNode);
        setPlaceOverlay(overlay);
        
        window.kakao.maps.event.addListener(createdMap, 'idle', searchPlaces);
    }, []);

    function searchPlaces(keyword, order) {
        if (!keyword) return;  // 키워드가 없으면 함수를 종료
        if (!map) return;      // map이 초기화되지 않았으면 함수 종료

        const places = new window.kakao.maps.services.Places();
        const bounds = map.getBounds();
        
        const swLatLng = bounds.getSouthWest();  // 지도의 남서쪽 좌표
        const neLatLng = bounds.getNorthEast();  // 지도의 북동쪽 좌표    

        places.keywordSearch(keyword, function (result, status) {
            if (status === window.kakao.maps.services.Status.OK) {
                displayPlaces(result, order);
            } else if (status === window.kakao.maps.services.Status.ERROR) {
                alert('검색 결과 중 오류가 발생했습니다.');
                return;
            }
        }, {
            bounds: new window.kakao.maps.LatLngBounds(swLatLng, neLatLng),
            size: 15  // 원하는 갯수만큼 설정 가능
        });
    }
    
    function addMarker(position, order) {
        const imageSrc = 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/places_category.png'; 
        const imageSize = new window.kakao.maps.Size(27, 28);
        const imgOptions = {
            spriteSize: new window.kakao.maps.Size(72, 208),
            spriteOrigin: new window.kakao.maps.Point(46, (order * 36)),
            offset: new window.kakao.maps.Point(11, 28)
        };
        const markerImage = new window.kakao.maps.MarkerImage(imageSrc, imageSize, imgOptions);
        const marker = new window.kakao.maps.Marker({
            position: position,
            image: markerImage
        });
        return marker;
    }

    function displayPlaces(places, order) {
        removeMarker();
    
        for (let i = 0; i < places.length; i++) {
            const marker = addMarker(new window.kakao.maps.LatLng(places[i].y, places[i].x), order);
            marker.setMap(map); //마커를 지도에 표시
            setMarkers(prevMarkers => [...prevMarkers, marker]);
    
            const infowindow = new window.kakao.maps.InfoWindow({
                content: '<div style="padding:5px;font-size:12px;">' + places[i].place_name + '</div>'
            });
    
            window.kakao.maps.event.addListener(marker, 'mouseover', makeOverListener(map, marker, infowindow));
            window.kakao.maps.event.addListener(marker, 'mouseout', makeOutListener(infowindow));
        }
    }
    
    function removeMarker() {
        for (let i = 0; i < markers.length; i++) {
            markers[i].setMap(null);
        }
        setMarkers([]);
    }

    function onClickCategory(event) {
        const el = event.srcElement || event.target; // event.target을 fallback으로 사용
        const category = el.id;
        // 이미 활성화된 카테고리를 다시 클릭한 경우
        if (category === activeCategory) {
            removeMarker();                 // 모든 마커 제거
            setActiveCategory(null);       // 활성 카테고리 상태 초기화
        } else {
            const keyword = categoryMap[category];
            const order = parseInt(el.getAttribute('data-order'), 10);
            searchPlaces(keyword, order);
            setActiveCategory(category);   // 활성 카테고리 상태 업데이트
        }
    }

    // 마커에 mouseover 이벤트와 mouseout 이벤트를 등록하는 함수입니다
    // mouseover 이벤트에는 infoWindow를 표시하도록 합니다
    function makeOverListener(map, marker, infowindow) {
        return function () {
            infowindow.open(map, marker);
        };
    }

    // mouseout 이벤트에는 infoWindow를 닫도록 합니다
    function makeOutListener(infowindow) {
        return function () {
            infowindow.close();
        };
    }

    return (
        <div style={{ position: 'relative' }}>
            <div className="auth-wrap" style={{position: 'relative', float: 'right'}}>
                {user ? (
                    <>
                        <span>Logged in as {user.email}</span>
                        <button onClick={signOutUser}>로그아웃</button>
                    </>
                ) : (
                    <>
                        <input type="email" placeholder="Email" onChange={e => setEmail(e.target.value)} />
                        <input type="password" placeholder="Password" onChange={e => setPassword(e.target.value)} />
                        <button onClick={signUp}>회원가입</button>
                        <button onClick={signIn}>로그인</button>
                    </>
                )}
            </div>
            <div id="map" ref={mapContainer} style={{ width: '1500px', height: '1000px', position: 'relative' }}>
                <ul id="category">
                    <li id="BK9" data-order="0" onClick={onClickCategory}>
                        <span class="category_bg bank"></span>
                        은행
                    </li>
                    <li id="MT1" data-order="1" onClick={onClickCategory}>
                        <span class="category_bg mart"></span>
                        마트
                    </li>
                    <li id="PM9" data-order="2" onClick={onClickCategory}>
                        <span class="category_bg pharmacy"></span>
                        약국
                    </li>
                    <li id="OL7" data-order="3" onClick={onClickCategory}>
                        <span class="category_bg oil"></span>
                        주유소
                    </li>
                    <li id="CE7" data-order="4" onClick={onClickCategory}>
                        <span class="category_bg cafe"></span>
                        카페
                    </li>
                    <li id="CS2" data-order="5" onClick={onClickCategory}>
                        <span class="category_bg store"></span>
                        편의점
                    </li>
                </ul>
            </div>
        </div>
    );
}

export default KakaoMap;
