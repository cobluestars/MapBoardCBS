import { ApolloClient, InMemoryCache, ApolloProvider, createHttpLink } from '@apollo/client';

// Apollo Client 설정
const httpLink = createHttpLink({
  uri: 'http://localhost:4000/',
});

const client = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
});

function ApolloClientSetup({ children }) {
  return (
    <ApolloProvider client={client}>
      {children}
    </ApolloProvider>
  );
}

export default ApolloClientSetup;