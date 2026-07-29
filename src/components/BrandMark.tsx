// JIHOOT 브랜드 심볼. 어두운 라운드 타일 위에 퀴즈 정답 4형태(삼각형·원·
// 다이아몬드·사각형)를 상·좌·우·하로 배치하고 가운데 흰 점을 둔다. 배경 타일까지
// SVG 안에 포함하므로 감싸는 요소에 별도 배경이 필요 없다. 크기는 className으로.
export default function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      {/* 어두운 라운드 타일 */}
      <rect x="0" y="0" width="48" height="48" rx="12" fill="#0e0e12" />
      {/* 위: 노란 삼각형 */}
      <path
        d="M24 7 L29.4 16.5 L18.6 16.5 Z"
        fill="#ffb71e"
        stroke="#ffb71e"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* 좌: 파란 원 */}
      <circle cx="11.5" cy="24" r="5.6" fill="#2f6bfe" />
      {/* 우: 빨간 다이아몬드 */}
      <path
        d="M36.5 18.4 L42.1 24 L36.5 29.6 L30.9 24 Z"
        fill="#fd443a"
        stroke="#fd443a"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* 아래: 초록 사각형 */}
      <rect x="18.4" y="31.5" width="11.2" height="11.2" rx="2.6" fill="#63c13b" />
      {/* 가운데 흰 점 */}
      <circle cx="24" cy="24" r="2.3" fill="#ffffff" />
    </svg>
  );
}
