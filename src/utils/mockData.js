// Mock data for development
export const mockZapData = [
  {
    id: '1',
    amount: 1000,
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
    sender: {
      name: 'BitcoinMaxi',
      pubkey: 'npub1xyz...',
      nip05: 'bitcoinmaxi@nostr.com',
      avatar: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
    },
    note: 'Just wrote a comprehensive guide on Lightning Network security. Understanding the trade-offs between convenience and self-custody is crucial for every Bitcoin user.',
    noteType: 'original',
    client: 'damus',
    engagement: {
      replies: 12,
      reposts: 8,
      likes: 34
    }
  },
  {
    id: '2',
    amount: 500,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    sender: {
      name: 'NostrFan',
      pubkey: 'npub1abc...',
      nip05: 'nostrfan@example.com',
      avatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
    },
    note: 'Great discussion on decentralized social media protocols! The future of communication is being built right here on Nostr.',
    noteType: 'reply',
    client: 'amethyst',
    engagement: {
      replies: 5,
      reposts: 3,
      likes: 18
    }
  },
  {
    id: '3',
    amount: 2100,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), // 6 hours ago
    sender: {
      name: 'LightningLover',
      pubkey: 'npub1def...',
      nip05: null,
      avatar: 'https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
    },
    note: 'The Lightning Network is revolutionizing how we think about digital payments. Instant, cheap, and private transactions are now a reality.',
    noteType: 'original',
    client: 'iris',
    engagement: {
      replies: 24,
      reposts: 15,
      likes: 67
    }
  },
  {
    id: '4',
    amount: 250,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), // 12 hours ago
    sender: {
      name: 'SatoshiSupporter',
      pubkey: 'npub1ghi...',
      nip05: 'satoshi@bitcoin.org',
      avatar: 'https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
    },
    note: 'Interesting perspective on proof-of-work vs proof-of-stake. Bitcoin\'s energy consumption is a feature, not a bug.',
    noteType: 'reply',
    client: 'snort',
    engagement: {
      replies: 8,
      reposts: 4,
      likes: 22
    }
  },
  {
    id: '5',
    amount: 750,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    sender: {
      name: 'Anonymous',
      pubkey: 'npub1jkl...',
      nip05: null,
      avatar: 'https://images.pexels.com/photos/1040881/pexels-photo-1040881.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
    },
    note: 'Building on Bitcoin is like building on solid bedrock. Every layer adds more utility while maintaining the security of the base layer.',
    noteType: 'original',
    client: 'nostrudel',
    engagement: {
      replies: 16,
      reposts: 9,
      likes: 41
    }
  },
  {
    id: '6',
    amount: 1500,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
    sender: {
      name: 'BitcoinMaxi',
      pubkey: 'npub1xyz...',
      nip05: 'bitcoinmaxi@nostr.com',
      avatar: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
    },
    note: 'The beauty of Bitcoin is in its simplicity and predictability. 21 million coins, transparent monetary policy, and decentralized governance.',
    noteType: 'original',
    client: 'damus',
    engagement: {
      replies: 31,
      reposts: 18,
      likes: 89
    }
  }
]