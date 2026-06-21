export function Avatar({ user, size = 22 }) {
  if (user && user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        className="avatar"
        style={{ width: size, height: size }}
      />
    );
  }

  const initial = ((user && user.name) || '?').trim().charAt(0).toUpperCase();
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}>
      {initial}
    </span>
  );
}
