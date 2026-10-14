// 예식 정보는 제공된 종이 청첩장 시안을 기준으로 입력했습니다.
// 참석 응답 링크와 계좌 정보는 확정 후 이 파일에서 교체하세요.
window.WEDDING_CONTENT = {
  // 실제 질문·선택지·이야기를 받은 뒤 교체하세요. 빈 선택지는 준비 화면으로 표시합니다.
  // 각 항목: { question: "질문", options: ["선택지", "선택지"], story: "선택 후 보여줄 이야기" }
  welcomeQuiz: [
    { question: "우리의 첫 만남은?", options: [], story: "" },
    { question: "함께 쌓아 온 우리의 시간", options: [], story: "" }
  ],
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
    "처음 마주 앉은 한 식탁에서\n우리의 이야기가 시작됐습니다.",
    "함께 움직이는 날도,\n나란히 쉬는 날도 좋았습니다.\n이제 앞으로의 날들을\n함께 이어가려 합니다.",
    "소중한 분들을 모시고\n그 첫날을 맞이하고 싶습니다."
  ],
  venue: "아르베 웨딩",
  address: "서울 강남구 봉은사로 302",
  naverMapUrl: "https://naver.me/xsZ9NoRb",
  // Naver Cloud Maps > Static Map의 공개 API Key ID. Secret Key는 절대 넣지 마세요.
  naverStaticMapKeyId: "vr5i2viwvu",
  naverStaticMapCenter: "127.039411,37.508679",
  kakaoMapUrl: "https://place.map.kakao.com/191889847",
  googleMapUrl: "https://www.google.com/maps/place/%EC%95%84%EB%A5%B4%EB%B2%A0%EC%9B%A8%EB%94%A9/data=!3m1!4b1!4m4!3m3!1s0x357ca3000cdb4565:0x3bf6331e47e5d979!16s%2Fg%2F11w4r2h2g4!20s8Q99G25Q%2BFQ7?entry=ttu&g_ep=EgoyMDI2MTAwNy4wIKXMDSoASAFQAw%3D%3D",
  busStops: [
    { name: "아크로힐스논현", routes: "지선버스 3412, 6411", mapUrl: "https://map.naver.com/p/search/%EC%84%9C%EC%9A%B8%20%EA%B0%95%EB%82%A8%EA%B5%AC%20%EC%95%84%ED%81%AC%EB%A1%9C%ED%9E%90%EC%8A%A4%EB%85%BC%ED%98%84%20%EB%B2%84%EC%8A%A4%EC%A0%95%EB%A5%98%EC%9E%A5" },
    { name: "스포월드·라움아트센터", routes: "간선버스 141, 242", mapUrl: "https://map.naver.com/p/search/%EC%8A%A4%ED%8F%AC%EC%9B%94%EB%93%9C.%EB%9D%BC%EC%9B%80%EC%95%84%ED%8A%B8%EC%84%BC%ED%84%B0" },
  ],
  rsvpMessage: "참석 여부를 알려주시면 정성껏 자리를 준비하겠습니다.",
  rsvpUrl: "",
  // Google Apps Script 웹 앱의 /exec 주소 (비밀 키가 아닙니다).
  rsvpEndpoint: "https://script.google.com/macros/s/AKfycbwsXU4naask-wN-mLaKAUV5KmWnUFley0uayAVtSvtUEa8PxuVBhhFxVDGZcBCGhmA_xw/exec",
  wreathMessage: "환경을 위해 화환을 받지 않고 있습니다.\n축하해 주시는 마음만 감사히 받겠습니다.",
  accounts: [
    { side: "신랑 측", label: "신랑", bank: "기업은행", number: "569-024015-01-012", holder: "백민규" },
    { side: "신랑 측", label: "신랑 아버지", bank: "KB국민은행", number: "703001-01-612595", holder: "백인봉" },
    { side: "신부 측", label: "신부", bank: "신한은행", number: "110-420-427670", holder: "박지해" },
    { side: "신부 측", label: "신부 아버지", bank: "농협은행", number: "100067-56-096708", holder: "박명환" },
    { side: "신부 측", label: "신부 어머니", bank: "농협", number: "421014-56-037167", holder: "전영숙" }
  ],
  // Generated from assets/opening/DSC*.jpg by npm run images.
  openingPhotos: window.OPENING_IMAGES || [],
  galleryPhotos: window.GALLERY_IMAGES || []
};
