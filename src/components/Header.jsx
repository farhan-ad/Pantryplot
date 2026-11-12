function Header() {
  return (
    <header className="header">
      <img
        src="/pantryplot-mark.svg"
        alt=""
        className="header-logo"
        width="52"
        height="52"
      />
      <div className="header-brand">
        <h1 className="header-title">Pantryplot</h1>
        <p className="header-tagline">Your pantry. Tonight’s possibilities.</p>
      </div>
    </header>
  );
}

export default Header;
