function urlBase64Decode(str) {
  let output = str.replace(/-/g, '+').replace(/_/g, '/');

  switch (output.length % 4) {
    case 0:
      break;

    case 2:
      output += '==';
      break;

    case 3:
      output += '=';
      break;

    default:
      throw new Error('Illegal base64url string!');
  }
  return decodeURIComponent(escape(atob(output)));
}

export function decodeToken(token) {
  const parts = token.split('.');

  if (parts.length !== 3) {
    throw new Error('The token is invalid');
  }

  const decoded = urlBase64Decode(parts[1]);

  if (!decoded) {
    throw new Error('Cannot decode the token');
  }

  return JSON.parse(decoded);
}
