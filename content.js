// 예식 정보는 제공된 종이 청첩장 시안을 기준으로 입력했습니다.
// 참석 응답 링크와 계좌 정보는 확정 후 이 파일에서 교체하세요.
window.WEDDING_CONTENT = {
  couple: "백민규 · 박지해",
  groomName: "백민규",
  brideName: "박지해",
  groomFather: "백인봉",
  groomMother: "박은희",
  brideFather: "박명환",
  brideMother: "전영숙",
  date: "2026년 12월 12일 토요일 오후 4시 30분",
  eventDate: "2026-12-12T16:30:00+09:00",
  calendarMessage: "12월 12일, 함께 시작하는 날에 뵙겠습니다.",
  invitation: [
    "처음 마주 앉은 한 식탁에서 우리의 이야기가 시작됐습니다.",
    "함께 움직이는 날도, 나란히 쉬는 날도 좋았습니다. 이제 앞으로의 날들을 함께 이어가려 합니다.",
    "소중한 분들을 모시고 그 첫날을 맞이하고 싶습니다."
  ],
  venue: "아르베 웨딩",
  address: "서울 강남구 봉은사로 302",
  naverMapUrl: "https://map.naver.com/p/search/%EC%84%9C%EC%9A%B8%20%EA%B0%95%EB%82%A8%EA%B5%AC%20%EB%B4%89%EC%9D%80%EC%82%AC%EB%A1%9C%20302",
  // Naver Cloud Maps > Static Map의 공개 API Key ID. Secret Key는 절대 넣지 마세요.
  naverStaticMapKeyId: "vr5i2viwvu",
  naverStaticMapCenter: "127.039411,37.508679",
  kakaoMapUrl: "https://map.kakao.com/?q=%EC%84%9C%EC%9A%B8%20%EA%B0%95%EB%82%A8%EA%B5%AC%20%EB%B4%89%EC%9D%80%EC%82%AC%EB%A1%9C%20302",
  googleMapUrl: "https://www.google.com/maps/search/?api=1&query=%EC%84%9C%EC%9A%B8%20%EA%B0%95%EB%82%A8%EA%B5%AC%20%EB%B4%89%EC%9D%80%EC%82%AC%EB%A1%9C%20302",
  rsvpMessage: "참석 여부를 알려주시면 정성껏 자리를 준비하겠습니다.",
  rsvpUrl: "",
  // Google Apps Script 웹 앱의 /exec 주소 (비밀 키가 아닙니다).
  rsvpEndpoint: "https://script.google.com/macros/s/AKfycbwsXU4naask-wN-mLaKAUV5KmWnUFley0uayAVtSvtUEa8PxuVBhhFxVDGZcBCGhmA_xw/exec",
  wreathMessage: "환경을 위해 화환을 받지 않고 있습니다.\n축하해 주시는 마음만 감사히 받겠습니다.",
  accounts: [
    { side: "신랑 측", label: "신랑", bank: "기업은행", number: "569-024015-01-012", holder: "백민규" },
    { side: "신랑 측", label: "신랑 아버지", bank: "KB국민은행", number: "703001-01-612595", holder: "백인봉" },
    { side: "신부 측", label: "신부", bank: "신한은행", number: "110-420-427670", holder: "박지해" },
    { side: "신부 측", label: "신부 아버지", bank: "농협은행", number: "100067-56-096708", holder: "박명환" }
  ],
  // Generated from assets/opening/DSC*.jpg by npm run images.
  openingPhotos: window.OPENING_IMAGES || [],
  galleryPhotos: window.GALLERY_IMAGES || []
};
