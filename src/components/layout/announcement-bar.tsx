const messages = [
  'Nigeria and Qatar',
  'Pickup and delivery',
  'Direct support from every store',
  'Independent branded storefronts',
  'Shop in NGN and QAR',
];

export default function AnnouncementBar() {
  const repeatedMessages = [...messages, ...messages];

  return (
    <div className="living-announcement bg-[#071019] text-white">
      <p className="sr-only">
        Nigeria and Qatar. Pickup and delivery. Direct support from every store.
      </p>

      <div className="living-announcement-track" aria-hidden="true">
        {repeatedMessages.map((message, index) => (
          <span
            key={`${message}-${index}`}
            className="living-announcement-item"
          >
            <span className="living-announcement-dot" />
            {message}
          </span>
        ))}
      </div>
    </div>
  );
}
