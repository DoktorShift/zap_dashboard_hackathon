<template>
  <div>
    <!-- Vue component template will be added here -->
  </div>
</template>

<script setup>
// ... (rest of the code remains the same until the problematic section)

      } catch (error) {
        console.warn('Periodic health check failed:', error)
        
        // If connection seems broken, try to reconnect
        if (error.message.includes('not initialized') || error.message.includes('timeout')) {
          console.log('Connection appears broken, attempting auto-reconnect...')
          try {
            await autoReconnect()
            console.log('Auto-reconnect successful')
          } catch (reconnectError) {
            console.error('Auto-reconnect failed:', reconnectError)
          }
        }
        setTimeout(async () => {
          // Also fetch notes data to ensure zaps are loaded
          await fetchUserNotes()
        }, 1000)
      }
    }
  }, 120000) // 2 minutes
}

// ... (rest of the code remains the same)
</script>