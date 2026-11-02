export default function ProfileAvatar({ user, className }) {
  const name = user?.fullName || 'User';
  return (
    <span className={className} role="img" aria-label={`${name} profile picture`}>
      {user?.profileImageUrl
        ? <img src={user.profileImageUrl} alt="" />
        : name.charAt(0).toUpperCase()}
    </span>
  );
}
