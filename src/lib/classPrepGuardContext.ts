import { createContext, useContext } from 'react';

/** true while the class prep wrap-up or lock blocks new student work. */
export const ClassPrepBlockingContext = createContext(false);

export const useIsClassPrepBlocking = () => useContext(ClassPrepBlockingContext);
