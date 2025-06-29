// Map NWC transaction data to our application's zap data structure
export function mapTransactionToZap(transaction, index) {
  // Generate a mock sender since NWC doesn't provide sender details for privacy
  const mockSenders = [
    {
      name: 'Anonymous',
      pubkey: 'npub1anonymous...',
      nip05: null,
      avatar: 'https://images.pexels.com/photos/1040881/pexels-photo-1040881.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
    },
    {
      name: 'BitcoinMaxi',
      pubkey: 'npub1bitcoinmaxi...',
      nip05: 'bitcoinmaxi@nostr.com',
      avatar: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
    },
    {
      name: 'NostrFan',
      pubkey: 'npub1nostrfan...',
      nip05: 'nostrfan@example.com',
      avatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
    },
    {
      name: 'LightningLover',
      pubkey: 'npub1lightning...',
      nip05: null,
      avatar: 'https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
    },
    {
      name: 'SatoshiSupporter',
      pubkey: 'npub1satoshi...',
      nip05: 'satoshi@bitcoin.org',
      avatar: 'https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
    }
  ]

  const mockNotes = [
    'Great insights on Lightning Network security and self-custody trade-offs!',
    'Excellent discussion on decentralized social media protocols.',
    'The Lightning Network is revolutionizing digital payments.',
    'Interesting perspective on proof-of-work vs proof-of-stake.',
    'Building on Bitcoin is like building on solid bedrock.',
    'The beauty of Bitcoin is in its simplicity and predictability.',
    'Thanks for sharing your knowledge about Lightning!',
    'Love your content about Bitcoin adoption.',
    'Keep up the great work on Nostr development.',
    'Your tutorials are helping so many people understand Bitcoin.'
  ]

  const mockClients = ['damus', 'amethyst', 'iris', 'snort', 'nostrudel']
  const mockNoteTypes = ['original', 'reply', 'repost']

  // Use transaction data where available, fallback to mock data
  const sender = mockSenders[index % mockSenders.length]
  const note = transaction.description || mockNotes[index % mockNotes.length]
  
  return {
    id: transaction.payment_hash || `mock-${index}`,
    amount: Math.floor(transaction.amount / 1000), // Convert from msats to sats
    timestamp: transaction.settled_at ? new Date(transaction.settled_at * 1000).toISOString() : new Date().toISOString(),
    sender,
    note,
    noteType: mockNoteTypes[index % mockNoteTypes.length],
    client: mockClients[index % mockClients.length],
    engagement: {
      replies: Math.floor(Math.random() * 30),
      reposts: Math.floor(Math.random() * 20),
      likes: Math.floor(Math.random() * 50)
    }
  }
}

export function processTransactions(transactions) {
  return transactions
    .filter(tx => tx.type === 'incoming' && tx.state === 'settled')
    .map(mapTransactionToZap)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
}