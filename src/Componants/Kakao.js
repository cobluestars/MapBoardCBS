import React, { useState, useEffect, useRef } from 'react';
import './Kakao.css';
import KakaoMap from './KakaoMap';
import CustomMenu from './CustomMenu';
import { useCallback } from 'react';

function Kakao(props) {
    const [places, setPlaces] = useState([]);
    const [keyword, setKeyword] = useState("이태원 맛집");

    const lat = props.event && props.event.latLng && props.event.latLng.getLat ? props.event.latLng.getLat() : null;
    const lng = props.event && props.event.latLng && props.event.latLng.getLng ? props.event.latLng.getLng() : null;

    const psRef = useRef(null);
    const mapRef = useRef(null);

    const imageSrc = "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png";

    const markers = useRef([]).current;

    // Kakao 컴포넌트
    const kakaoMarkersRef = useRef([]);

    const markersRef = useRef([]);
    const infowindowsRef = useRef([]);
    const [visibleMarkers, setVisibleMarkers] = useState([]);

    // Custom marker 등록을 위한 상태 추가
    const [customData, setCustomData] = useState({
        category: "알바",
        title: "",
        content: "",
        duration: "",
        date: new Date(),
    });

    const [isSettingPin, setIsSettingPin] = useState(false);  

    // Custom marker 설정 로직 추가
    function setCustomMarker(e) {
        if (!isSettingPin) return;
        
        // Kakao Map에서 LatLng를 가져올 때의 메서드 수정
        const kakaoMarkerPosition = new window.kakao.maps.LatLng(e.latLng.getLat(), e.latLng.getLng());

        const kakaoMarker = new window.kakao.maps.Marker({
            map: mapRef.current,
            position: kakaoMarkerPosition,
            title: customData.title,
        });
        
        markersRef.current.push(kakaoMarker);

        const infowindow = new window.kakao.maps.InfoWindow({
            content: `<div style="padding:5px;z-index:1;">${customData.title}</div>`,
            zIndex: 1
        });

        window.kakao.maps.event.addListener(kakaoMarker, 'click', () => {
            infowindow.open(mapRef.current, kakaoMarker);
        });

        infowindowsRef.current.push(infowindow);

        setIsSettingPin(false);
        // 마커를 배치하면 바로 마커 모양의 마우스 포인터를 해제
        document.body.classList.remove('marker-cursor');
    }

    // CustomMenu 컴포넌트에서 setIsSettingPin 함수가 호출될 때마다 effect 실행
    useEffect(() => {
        if (isSettingPin) {
            document.body.classList.add('marker-cursor');
        } else {
            document.body.classList.remove('marker-cursor');
        }
    }, [isSettingPin]);

    useEffect(() => {
        if (mapRef.current) {
            window.kakao.maps.event.addListener(mapRef.current, 'click', setCustomMarker);
            return () => {
                window.kakao.maps.event.removeListener(mapRef.current, 'click', setCustomMarker);
            };
        }
    }, [mapRef.current]);

    useEffect(() => {
        psRef.current = new window.kakao.maps.services.Places();
    }, []);

    function searchPlaces() {
        if (!keyword.trim()) {
            alert('키워드를 입력해주세요!');
            return;
        }
    
        if (psRef.current) {
            psRef.current.keywordSearch(keyword, placesSearchCB);
        } else {
            console.error('psRef.current is not available!');
        }
    }

    function placesSearchCB(data, status) {
      if (status === window.kakao.maps.services.Status.OK) {
          if (!Array.isArray(data)) {
              console.error('Received data is not an array:', data);
              return;
          }
          setPlaces(data);
          displayPlaces(data);
      } else {
          alert('검색 결과가 없습니다.');
      }
    }

    function displayPlaces(places) {
        const bounds = new window.kakao.maps.LatLngBounds();
        
        removeAllMarkers();
        
        const imageSrc = "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_number_blue.png";
        
        places.forEach((place, idx) => {
            const placePosition = new window.kakao.maps.LatLng(place.y, place.x);
            const kakaoMarkerTitle = place.place_name;
            
            const imageSize = new window.kakao.maps.Size(36, 37);
            const imgOptions = {
                spriteSize: new window.kakao.maps.Size(36, 691),
                spriteOrigin: new window.kakao.maps.Point(0, (idx * 46) + 10),
                offset: new window.kakao.maps.Point(13, 37)
            };
    
            // 마커 이미지를 생성   
            const markerImage = new window.kakao.maps.MarkerImage(imageSrc, imageSize, imgOptions);
            
            // 마커 생성
            const kakaoMarker = new window.kakao.maps.Marker({
                map: mapRef.current,
                position: placePosition,
                title: kakaoMarkerTitle,
                image: markerImage
            });
    
            kakaoMarkersRef.current.push(kakaoMarker);
            bounds.extend(placePosition);
    
            const infowindow = new window.kakao.maps.InfoWindow({
                content: '<div style="padding:5px;z-index:1;">' + kakaoMarkerTitle + '</div>',
                zIndex: 1
            });
    
            window.kakao.maps.event.addListener(kakaoMarker, 'mouseover', () => {
                infowindow.open(mapRef.current, kakaoMarker);
            });
    
            window.kakao.maps.event.addListener(kakaoMarker, 'mouseout', () => {
                infowindow.close();
            });
    
            infowindowsRef.current.push(infowindow);
        });
    
        mapRef.current.setBounds(bounds);
    } 
    
    function removeAllMarkers() {
        kakaoMarkersRef.current.forEach(kakaoMarker => {
            if (kakaoMarker && typeof kakaoMarker.setMap === 'function') {
                kakaoMarker.setMap(null);
            }
        });
        kakaoMarkersRef.current = [];
    }

    const handleMouseOver = useCallback((index) => {
        try {
            // console.log("infowindow: ", infowindowsRef.current[index]);
            // console.log("mapRef.current: ", mapRef.current);
            // console.log("kakaoMarkersRef length:", kakaoMarkersRef.current.length);  // 길이 출력
            // console.log("current index:", index);  // 현재 인덱스 출력
            // console.log("kakaoMarker: ", kakaoMarkersRef.current[index]);

            const infowindow = infowindowsRef.current[index];
            const kakaoMarker = kakaoMarkersRef.current[index];
    
            if (infowindow && mapRef.current && kakaoMarker) {
                infowindow.open(mapRef.current, kakaoMarker);
            } else {
                console.error("One of the required objects (infowindow, map, kakaoMarker) is not initialized.");
            }
        } catch (error) {
            console.error("Error occurred in onMouseOver:", error);
        }
    },  [infowindowsRef, mapRef, kakaoMarkersRef]);

    function handleMapInitialized(mapInstance) {
        mapRef.current = mapInstance;
    }

    const handleMouseOut = useCallback((index) => {
        try {
            const infowindow = infowindowsRef.current[index];
            
            if (infowindow) {
                // 마커 위의 인포윈도우를 제거
                infowindow.close();
            }
        } catch (error) {
            console.error("Error occurred in onMouseOut:", error);
        }
    }, [infowindowsRef]);

    return (
        <div className="map_wrap">
            <KakaoMap 
                onMapInitialized={handleMapInitialized}
                mapRef={mapRef} 
                imageSrc={imageSrc}
            />
            
            <div id="menu_wrap" className="bg_white">
                <div className="option">
                    <div>
                        키워드 :
                        <input
                            type="text"
                            value={keyword}
                            onChange={e => setKeyword(e.target.value)}
                            size="15"
                        />
                        <button onClick={searchPlaces}>검색하기</button>
                    </div>
                </div>
                <hr />
                <ul id="placesList">
                    {places.map((place, index) => (
                        <li 
                            key={index} 
                            className="item"
                            onMouseOver={() => handleMouseOver(index)}
                            onMouseOut={() => handleMouseOut(index)}
                        >
                            <span className={`markerbg marker_${index + 1}`}></span>
                            <div className="info">
                                <h4>{index + 1}. {place.place_name}</h4>
                                <p className="jibun gray">{place.road_address_name}</p> 
                                <p className="jibun gray">{place.address_name}</p>
                                <p className="tel">{place.phone}</p>
                                <br/>
                            </div>
                        </li>
                    ))}
                </ul>
                <div id="pagination">
                    {/* TODO: Add pagination */}
                </div>
            </div>

            {/* Custom Menu */}
            
            <CustomMenu 
                customData={customData} 
                setCustomData={setCustomData}
                setIsSettingPin={setIsSettingPin}
                places={places}
                infowindowsRef={infowindowsRef}
                markersRef={markersRef}
                mapRef={mapRef}
                visibleMarkers={visibleMarkers}
                setVisibleMarkers={setVisibleMarkers}
            />

        </div>
    );
}

export default Kakao;
