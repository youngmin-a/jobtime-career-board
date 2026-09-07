export default function Home() {
  return (
    <main>
      <p className="eyebrow">MY FIRST PROJECT</p>
      <h1>아이디어를 말하면,<br />여기서 시작됩니다.</h1>
      <p className="intro">나의 바이브코딩 작업실입니다. 만들고 싶은 것을 설명하고,<br className="desktop" /> 작은 기능부터 하나씩 완성해 보세요.</p>
      <section aria-label="시작 순서">
        <article><span>01</span><h2>무엇을 만들까요?</h2><p>누가 사용할지, 어떤 불편함을 해결할지, 꼭 필요한 기능을 말해 주세요.</p></article>
        <article><span>02</span><h2>하나씩 만들어 봐요</h2><p>먼저 작은 기능 하나를 만들고, 이 화면에서 결과를 확인해 보세요.</p></article>
        <article><span>03</span><h2>보고, 고치고, 완성해요</h2><p>원하는 점과 아쉬운 점을 알려 주세요. 확인하면서 더 나은 앱으로 바꿔 갑니다.</p></article>
      </section>
      <aside><strong>첫 요청 예시</strong><p>“내가 할 일을 추가하고 완료 표시할 수 있는 간단한 앱을 만들어줘.”</p></aside>
      <footer>첫 화면이 보이면, 개발환경의 시작 준비가 된 것입니다.</footer>
    </main>
  );
}
